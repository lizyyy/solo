const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class Store {
  constructor(options = {}) {
    this.config = options.config || config.DEFAULT_CONFIG;
    this.workspaceRoot = options.workspaceRoot || config.getWorkspaceRoot();
  }

  getPath(relativePath) {
    return path.join(this.workspaceRoot, relativePath);
  }

  async loadConfig() {
    const configPath = this.getPath('.photo-checker.json');
    if (!(await fs.pathExists(configPath))) {
      return null;
    }
    return await fs.readJson(configPath);
  }

  async saveConfig(configData) {
    const configPath = this.getPath('.photo-checker.json');
    await fs.writeJson(configPath, configData, { spaces: 2 });
    return configPath;
  }

  async initializeWorkspace() {
    const dirs = [
      this.config.directories.staging,
      this.config.directories.archive,
      this.config.directories.reports,
      this.config.directories.logs
    ];

    for (const dir of dirs) {
      await fs.ensureDir(this.getPath(dir));
    }

    const configData = {
      version: this.config.version,
      initializedAt: new Date().toISOString(),
      workspaceRoot: this.workspaceRoot,
      directories: this.config.directories,
      validation: this.config.validation,
      filenames: this.config.filenames
    };

    await this.saveConfig(configData);

    return configData;
  }

  async saveStagingManifest(scanResult, validationResult = null) {
    const manifestPath = this.getPath(
      path.join(this.config.directories.staging, this.config.filenames.stagingManifest)
    );

    const manifest = {
      id: uuidv4(),
      generatedAt: new Date().toISOString(),
      scanResult,
      validationResult
    };

    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    return manifest;
  }

  async loadStagingManifest() {
    const manifestPath = this.getPath(
      path.join(this.config.directories.staging, this.config.filenames.stagingManifest)
    );

    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }

    return await fs.readJson(manifestPath);
  }

  async saveLastCheckReport(report) {
    const reportPath = this.getPath(
      path.join(this.config.directories.staging, this.config.filenames.lastCheckReport)
    );

    await fs.writeJson(reportPath, report, { spaces: 2 });
    return reportPath;
  }

  async loadLastCheckReport() {
    const reportPath = this.getPath(
      path.join(this.config.directories.staging, this.config.filenames.lastCheckReport)
    );

    if (!(await fs.pathExists(reportPath))) {
      return null;
    }

    return await fs.readJson(reportPath);
  }

  async getAuditLogPath() {
    return this.getPath(
      path.join(this.config.directories.logs, this.config.filenames.auditLog)
    );
  }

  async loadAuditLog() {
    const logPath = await this.getAuditLogPath();
    
    if (!(await fs.pathExists(logPath))) {
      return [];
    }

    return await fs.readJson(logPath);
  }

  async appendAuditLog(entry) {
    const logPath = await this.getAuditLogPath();
    const log = await this.loadAuditLog();

    const newEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    log.push(newEntry);
    await fs.writeJson(logPath, log, { spaces: 2 });

    return newEntry;
  }

  async recordArchiveTransaction(transaction) {
    const entry = {
      type: 'archive',
      action: 'commit',
      transactionId: transaction.id,
      photos: transaction.photos.map(p => ({
        originalPath: p.originalPath,
        archivePath: p.archivePath,
        hash: p.hash,
        collectionId: p.collectionId
      })),
      summary: {
        total: transaction.photos.length,
        successful: transaction.successful?.length || 0,
        failed: transaction.failed?.length || 0
      }
    };

    return await this.appendAuditLog(entry);
  }

  async recordImport(importData) {
    const entry = {
      type: 'import',
      action: 'import',
      source: importData.source,
      photos: importData.photos?.map(p => ({
        path: p.path,
        name: p.name,
        hash: p.hash
      })) || [],
      summary: {
        total: importData.photos?.length || 0
      }
    };

    return await this.appendAuditLog(entry);
  }

  async getArchiveIndexPath() {
    return this.getPath(
      path.join(this.config.directories.archive, 'archive-index.json')
    );
  }

  async loadArchiveIndex() {
    const indexPath = await this.getArchiveIndexPath();
    
    if (!(await fs.pathExists(indexPath))) {
      return {
        version: '1.0.0',
        collections: {},
        photos: [],
        lastUpdated: null
      };
    }

    return await fs.readJson(indexPath);
  }

  async saveArchiveIndex(index) {
    const indexPath = await this.getArchiveIndexPath();
    index.lastUpdated = new Date().toISOString();
    await fs.writeJson(indexPath, index, { spaces: 2 });
    return index;
  }

  async updateArchiveIndex(archivedPhotos) {
    const index = await this.loadArchiveIndex();

    for (const photo of archivedPhotos) {
      if (!index.collections[photo.collectionId]) {
        index.collections[photo.collectionId] = {
          photos: [],
          firstArchivedAt: new Date().toISOString()
        };
      }

      const photoEntry = {
        id: uuidv4(),
        originalPath: photo.originalPath,
        archivePath: photo.archivePath,
        filename: photo.filename,
        hash: photo.hash,
        size: photo.size,
        collectionId: photo.collectionId,
        archivedAt: new Date().toISOString()
      };

      index.collections[photo.collectionId].photos.push(photoEntry);
      index.photos.push(photoEntry);
    }

    await this.saveArchiveIndex(index);
    return index;
  }

  async isPhotoArchived(hash) {
    const index = await this.loadArchiveIndex();
    return index.photos.some(p => p.hash === hash);
  }

  async findArchivedPhotosByCollectionId(collectionId) {
    const index = await this.loadArchiveIndex();
    return index.collections[collectionId]?.photos || [];
  }
}

module.exports = {
  Store
};
