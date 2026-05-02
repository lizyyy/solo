const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const { Store } = require('./store');
const { Validator, RULE_SEVERITY } = require('./validator');

class Archiver {
  constructor(options = {}) {
    this.config = options.config || config.DEFAULT_CONFIG;
    this.workspaceRoot = options.workspaceRoot || config.getWorkspaceRoot();
    this.store = options.store || new Store({ 
      config: this.config, 
      workspaceRoot: this.workspaceRoot 
    });
    this.validator = options.validator || new Validator({
      config: this.config,
      workspaceRoot: this.workspaceRoot
    });
  }

  getPath(relativePath) {
    return path.join(this.workspaceRoot, relativePath);
  }

  extractCollectionId(photo) {
    return this.validator.extractCollectionIdFromFilename(photo.name);
  }

  generateArchivePath(photo, collectionId) {
    const archiveDir = this.config.directories.archive;
    const safeCollectionId = collectionId.replace(/[^a-zA-Z0-9\-]/g, '_');
    return path.join(archiveDir, safeCollectionId, photo.name);
  }

  async prepareArchiveTransaction(scanResult, validationResult) {
    const transaction = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'prepared',
      photos: [],
      scanResult,
      validationResult
    };

    for (const photo of scanResult.photos) {
      const collectionId = this.extractCollectionId(photo);
      
      const photoEntry = {
        originalPath: photo.path,
        filename: photo.name,
        hash: photo.hash,
        size: photo.size,
        collectionId,
        archivePath: collectionId ? this.generateArchivePath(photo, collectionId) : null,
        canArchive: collectionId !== null
      };

      transaction.photos.push(photoEntry);
    }

    return transaction;
  }

  async validateTransaction(transaction) {
    const issues = [];

    const errors = transaction.validationResult?.results?.filter(
      r => !r.passed && r.severity === RULE_SEVERITY.ERROR
    ) || [];

    if (errors.length > 0) {
      issues.push({
        type: 'validation_errors',
        severity: RULE_SEVERITY.ERROR,
        message: `存在 ${errors.length} 个验证错误，无法进行归档`,
        details: errors.map(e => e.message)
      });
    }

    for (const photo of transaction.photos) {
      if (!photo.collectionId) {
        issues.push({
          type: 'missing_collection_id',
          severity: RULE_SEVERITY.WARNING,
          message: `照片 ${photo.filename} 无法提取馆藏号，将跳过归档`,
          photo: photo.originalPath
        });
      }
    }

    for (const photo of transaction.photos) {
      if (photo.canArchive) {
        const isArchived = await this.store.isPhotoArchived(photo.hash);
        if (isArchived) {
          issues.push({
            type: 'already_archived',
            severity: RULE_SEVERITY.WARNING,
            message: `照片 ${photo.filename} (哈希: ${photo.hash.substring(0, 12)}...) 已存在于归档中`,
            photo: photo.originalPath,
            hash: photo.hash
          });
        }
      }
    }

    return {
      canCommit: errors.length === 0,
      issues,
      totalPhotos: transaction.photos.length,
      archiveablePhotos: transaction.photos.filter(p => p.canArchive).length
    };
  }

  async executeArchive(transaction, options = {}) {
    const {
      skipAlreadyArchived = true,
      dryRun = false
    } = options;

    const result = {
      transactionId: transaction.id,
      executedAt: new Date().toISOString(),
      dryRun,
      successful: [],
      failed: [],
      skipped: []
    };

    for (const photo of transaction.photos) {
      if (!photo.canArchive) {
        result.skipped.push({
          ...photo,
          reason: '无法提取馆藏号'
        });
        continue;
      }

      if (skipAlreadyArchived) {
        const isArchived = await this.store.isPhotoArchived(photo.hash);
        if (isArchived) {
          result.skipped.push({
            ...photo,
            reason: '已存在于归档中'
          });
          continue;
        }
      }

      if (dryRun) {
        result.successful.push({
          ...photo,
          note: '模拟执行（dry run）'
        });
        continue;
      }

      try {
        const sourcePath = this.getPath(photo.originalPath);
        const destPath = this.getPath(photo.archivePath);

        await fs.ensureDir(path.dirname(destPath));

        await fs.copy(sourcePath, destPath);

        const destHash = await this.calculateFileHashDirect(destPath);
        if (destHash !== photo.hash) {
          await fs.remove(destPath);
          throw new Error(`文件复制后哈希不匹配 (源: ${photo.hash}, 目标: ${destHash})`);
        }

        result.successful.push(photo);
      } catch (error) {
        result.failed.push({
          ...photo,
          error: error.message
        });
      }
    }

    return result;
  }

  async calculateFileHashDirect(absolutePath, algorithm = 'sha256') {
    const crypto = require('crypto');
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(absolutePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async finalizeTransaction(transaction, archiveResult) {
    const successfulPhotos = archiveResult.successful.filter(p => !p.note);

    if (successfulPhotos.length > 0 && !archiveResult.dryRun) {
      await this.store.updateArchiveIndex(successfulPhotos);
    }

    const logEntry = {
      transactionId: transaction.id,
      photos: transaction.photos,
      successful: archiveResult.successful,
      failed: archiveResult.failed,
      skipped: archiveResult.skipped
    };

    await this.store.recordArchiveTransaction(logEntry);

    return {
      transactionId: transaction.id,
      finalizedAt: new Date().toISOString(),
      summary: {
        total: transaction.photos.length,
        successful: archiveResult.successful.length,
        failed: archiveResult.failed.length,
        skipped: archiveResult.skipped.length
      }
    };
  }

  async commit(scanResult, validationResult, options = {}) {
    const {
      dryRun = false,
      force = false
    } = options;

    const transaction = await this.prepareArchiveTransaction(scanResult, validationResult);
    const validation = await this.validateTransaction(transaction);

    if (!validation.canCommit && !force) {
      throw new Error(`归档验证失败: ${validation.issues.map(i => i.message).join('; ')}`);
    }

    const archiveResult = await this.executeArchive(transaction, {
      skipAlreadyArchived: true,
      dryRun
    });

    const finalResult = await this.finalizeTransaction(transaction, archiveResult);

    return {
      ...finalResult,
      validation,
      archiveResult
    };
  }
}

module.exports = {
  Archiver
};
