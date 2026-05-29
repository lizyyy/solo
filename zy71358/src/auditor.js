const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class MetadataAuditor {
  constructor(options = {}) {
    this.options = {
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      strictMode: options.strictMode !== false,
      ...options
    };
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      items: [],
      anomalies: []
    };
  }

  calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(this.options.hashAlgorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  calculateBufferHash(buffer) {
    return crypto.createHash(this.options.hashAlgorithm).update(buffer).digest('hex');
  }

  async auditItem(item, index) {
    const auditResult = {
      index: index + 1,
      tokenId: item.tokenId || item.chainId || item.id,
      name: item.name || item.title || '未命名作品',
      creator: item.creator || item.artist || '未知创作者',
      checks: [],
      status: 'PASS',
      warnings: [],
      errors: []
    };

    if (!auditResult.tokenId) {
      auditResult.errors.push('缺少链上编号');
      auditResult.status = 'FAIL';
    }

    if (item.imageHash && item.imageBuffer) {
      const actualHash = this.calculateBufferHash(item.imageBuffer);
      const hashMatch = actualHash.toLowerCase() === item.imageHash.toLowerCase();
      
      auditResult.checks.push({
        type: 'hash_verification',
        name: '图片哈希校验',
        expected: item.imageHash.toLowerCase(),
        actual: actualHash.toLowerCase(),
        passed: hashMatch
      });

      if (!hashMatch) {
        auditResult.errors.push(`图片哈希不匹配: 期望 ${item.imageHash.substring(0, 16)}..., 实际 ${actualHash.substring(0, 16)}...`);
        auditResult.status = 'FAIL';
      }
    } else if (item.imagePath) {
      try {
        const actualHash = await this.calculateFileHash(item.imagePath);
        if (item.imageHash) {
          const hashMatch = actualHash.toLowerCase() === item.imageHash.toLowerCase();
          auditResult.checks.push({
            type: 'hash_verification',
            name: '图片哈希校验',
            expected: item.imageHash.toLowerCase(),
            actual: actualHash.toLowerCase(),
            passed: hashMatch
          });
          if (!hashMatch) {
            auditResult.errors.push(`图片哈希不匹配: 期望 ${item.imageHash.substring(0, 16)}..., 实际 ${actualHash.substring(0, 16)}...`);
            auditResult.status = 'FAIL';
          }
        } else {
          auditResult.warnings.push('未提供图片哈希，已计算实际哈希供参考');
          auditResult.checks.push({
            type: 'hash_calculation',
            name: '图片哈希计算',
            actual: actualHash.toLowerCase(),
            passed: true
          });
        }
      } catch (e) {
        auditResult.errors.push(`无法读取图片文件: ${e.message}`);
        auditResult.status = 'FAIL';
      }
    } else {
      auditResult.warnings.push('未提供图片数据，跳过哈希校验');
    }

    if (item.rights || item.license) {
      const rights = item.rights || item.license;
      const now = new Date();
      
      if (rights.expiryDate || rights.expiresAt) {
        const expiryDate = new Date(rights.expiryDate || rights.expiresAt);
        const isExpired = expiryDate < now;
        
        auditResult.checks.push({
          type: 'rights_expiry',
          name: '权益有效期检查',
          expiryDate: expiryDate.toISOString(),
          daysRemaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
          passed: !isExpired
        });

        if (isExpired) {
          auditResult.errors.push(`权益已过期: ${expiryDate.toLocaleDateString()}`);
          auditResult.status = 'FAIL';
        } else if ((expiryDate - now) < (30 * 24 * 60 * 60 * 1000)) {
          auditResult.warnings.push(`权益将在30天内过期: ${expiryDate.toLocaleDateString()}`);
        }
      }

      if (rights.version) {
        auditResult.checks.push({
          type: 'rights_version',
          name: '权益版本检查',
          version: rights.version,
          passed: true
        });
      }
    } else {
      auditResult.warnings.push('未提供权益信息');
    }

    if (item.metadata) {
      const requiredFields = ['name', 'description', 'image'];
      const missingFields = requiredFields.filter(f => !item.metadata[f]);
      
      auditResult.checks.push({
        type: 'metadata_completeness',
        name: '元数据完整性',
        missingFields,
        passed: missingFields.length === 0
      });

      if (missingFields.length > 0) {
        if (this.options.strictMode) {
          auditResult.errors.push(`元数据缺少必填字段: ${missingFields.join(', ')}`);
          auditResult.status = 'FAIL';
        } else {
          auditResult.warnings.push(`元数据缺少字段: ${missingFields.join(', ')}`);
        }
      }
    }

    return auditResult;
  }

  checkDuplicates(items) {
    const tokenIdMap = new Map();
    const duplicates = [];

    items.forEach((item, index) => {
      const tokenId = item.tokenId || item.chainId || item.id;
      if (!tokenId) return;

      if (tokenIdMap.has(tokenId)) {
        duplicates.push({
          tokenId,
          indices: [tokenIdMap.get(tokenId), index + 1],
          type: 'duplicate_token_id'
        });
      } else {
        tokenIdMap.set(tokenId, index + 1);
      }
    });

    return duplicates;
  }

  async auditBatch(items) {
    this.results = {
      total: items.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      items: [],
      anomalies: [],
      summary: {
        hashFailures: 0,
        duplicateIds: 0,
        expiredRights: 0,
        missingMetadata: 0
      }
    };

    const duplicates = this.checkDuplicates(items);
    this.results.anomalies.push(...duplicates);
    this.results.summary.duplicateIds = duplicates.length;

    for (let i = 0; i < items.length; i++) {
      const result = await this.auditItem(items[i], i);
      
      const hasDuplicate = duplicates.some(d => 
        d.indices.includes(i + 1)
      );
      if (hasDuplicate) {
        result.errors.push('链上编号重复');
        result.status = 'FAIL';
      }

      this.results.items.push(result);

      if (result.status === 'PASS') {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
      this.results.warnings += result.warnings.length;

      result.checks.forEach(check => {
        if (!check.passed) {
          if (check.type === 'hash_verification') this.results.summary.hashFailures++;
          if (check.type === 'rights_expiry') this.results.summary.expiredRights++;
          if (check.type === 'metadata_completeness') this.results.summary.missingMetadata++;
        }
      });
    }

    const allAnomalies = [];
    this.results.items.forEach((item, idx) => {
      item.errors.forEach(err => {
        allAnomalies.push({
          index: idx + 1,
          tokenId: item.tokenId,
          name: item.name,
          type: 'error',
          message: err
        });
      });
      item.warnings.forEach(warn => {
        allAnomalies.push({
          index: idx + 1,
          tokenId: item.tokenId,
          name: item.name,
          type: 'warning',
          message: warn
        });
      });
    });
    this.results.anomalies = [...this.results.anomalies, ...allAnomalies];

    this.results.auditTime = new Date().toISOString();
    this.results.auditId = crypto.randomUUID();

    return this.results;
  }

  getAnomalyList() {
    return this.results.anomalies;
  }

  getSummary() {
    return {
      auditId: this.results.auditId,
      auditTime: this.results.auditTime,
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      passRate: this.results.total > 0 ? ((this.results.passed / this.results.total) * 100).toFixed(2) + '%' : '0%',
      warnings: this.results.warnings,
      summary: this.results.summary,
      anomalyCount: this.results.anomalies.length
    };
  }
}

module.exports = MetadataAuditor;
