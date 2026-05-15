const fs = require('fs');
const path = require('path');

class CacheCleaner {
  constructor(options = {}) {
    this.cacheDirs = options.cacheDirs || [];
    this.dryRun = options.dryRun !== false;
    this.force = options.force || false;
    this.candidateList = [];
    this.cleanedItems = [];
    this.failedItems = [];
    this.boundaryResults = [];
    this.auditLog = [];
  }

  generateCandidateList(patterns = ['*.tmp', '*.cache']) {
    const startTime = Date.now();
    const beforeStats = this.getDirectoryStats();

    this.candidateList = [];
    
    for (const dir of this.cacheDirs) {
      if (!fs.existsSync(dir)) {
        this.failedItems.push({
          path: dir,
          reason: '目录不存在',
          type: 'candidate_generation',
          timestamp: new Date().toISOString()
        });
        continue;
      }
      this.scanDirectory(dir, patterns);
    }

    const endTime = Date.now();
    
    return {
      candidates: this.candidateList,
      beforeStats,
      duration: endTime - startTime,
      count: this.candidateList.length
    };
  }

  scanDirectory(dir, patterns) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          this.scanDirectory(fullPath, patterns);
        } else {
          for (const pattern of patterns) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(item)) {
              this.candidateList.push({
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime,
                isProtected: this.checkIfProtected(fullPath)
              });
              break;
            }
          }
        }
      }
    } catch (error) {
      this.failedItems.push({
        path: dir,
        reason: `扫描失败: ${error.message}`,
        type: 'scan_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  checkIfProtected(filePath) {
    const protectedPatterns = [
      /production/,
      /important/,
      /backup/,
      /_keep/,
      /\.gitkeep/
    ];
    return protectedPatterns.some(pattern => pattern.test(filePath.toLowerCase()));
  }

  executeClean(candidates = this.candidateList) {
    const startTime = Date.now();
    const beforeStats = this.getDirectoryStats();
    this.cleanedItems = [];
    this.failedItems = [];

    const safeCandidates = candidates.filter(item => {
      if (item.isProtected && !this.force) {
        this.boundaryResults.push({
          path: item.path,
          action: 'skipped',
          reason: '受保护文件，需使用 --force 覆盖',
          timestamp: new Date().toISOString()
        });
        return false;
      }
      return true;
    });

    for (const item of safeCandidates) {
      try {
        if (!this.dryRun) {
          fs.unlinkSync(item.path);
          this.auditLog.push({
            action: 'delete',
            path: item.path,
            size: item.size,
            timestamp: new Date().toISOString(),
            operator: process.env.USER || 'unknown'
          });
        }
        this.cleanedItems.push(item);
      } catch (error) {
        this.failedItems.push({
          path: item.path,
          reason: `删除失败: ${error.message}`,
          type: 'clean_error',
          timestamp: new Date().toISOString()
        });
      }
    }

    const endTime = Date.now();
    const afterStats = this.getDirectoryStats();

    return {
      beforeStats,
      afterStats,
      cleanedCount: this.cleanedItems.length,
      failedCount: this.failedItems.length,
      duration: endTime - startTime,
      dryRun: this.dryRun
    };
  }

  rollback() {
    console.log('警告: 回滚操作需要备份支持');
    console.log('当前实现仅提供审计日志，建议在生产环境前先执行 --dry-run');
    return this.auditLog;
  }

  getDirectoryStats() {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      directories: {}
    };

    for (const dir of this.cacheDirs) {
      if (fs.existsSync(dir)) {
        const dirStats = this.calculateDirSize(dir);
        stats.directories[dir] = dirStats;
        stats.totalFiles += dirStats.fileCount;
        stats.totalSize += dirStats.totalSize;
      }
    }

    return stats;
  }

  calculateDirSize(dir) {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subStats = this.calculateDirSize(fullPath);
          totalSize += subStats.totalSize;
          fileCount += subStats.fileCount;
        } else {
          totalSize += stat.size;
          fileCount++;
        }
      }
    } catch (error) {
      // 静默处理
    }

    return { totalSize, fileCount };
  }

  getCandidateList() {
    return this.candidateList;
  }

  getFailedItems() {
    return this.failedItems;
  }

  getBoundaryResults() {
    return this.boundaryResults;
  }

  getAuditLog() {
    return this.auditLog;
  }
}

module.exports = CacheCleaner;
