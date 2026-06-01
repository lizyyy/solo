const fs = require('fs');
const path = require('path');
const config = require('./config');

class BatchProcessor {
  constructor(options = {}) {
    this.continueOnError = options.continueOnError ?? config.batch.continueOnError;
    this.maxRetries = options.maxRetries ?? config.batch.maxRetries;
    this.results = [];
    this.errors = [];
  }

  async processFiles(filePaths, processorFn, options = {}) {
    const results = [];
    const errors = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.processWithRetry(filePath, processorFn, options);
        results.push({
          filePath,
          fileName: path.basename(filePath),
          status: 'success',
          processedAt: new Date().toISOString(),
          data: result
        });
      } catch (error) {
        const errorRecord = {
          filePath,
          fileName: path.basename(filePath),
          status: 'error',
          processedAt: new Date().toISOString(),
          error: error.message,
          errorStack: error.stack
        };
        
        errors.push(errorRecord);
        
        if (!this.continueOnError) {
          throw new Error(`处理失败，已停止: ${error.message}`);
        }
        
        results.push({
          ...errorRecord,
          data: null
        });
      }
    }
    
    this.results = results;
    this.errors = errors;
    
    return {
      summary: this.getSummary(),
      results,
      errors
    };
  }

  async processWithRetry(filePath, processorFn, options) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await processorFn(filePath, options);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }
    
    throw lastError;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  scanDirectory(directoryPath, extensions = config.supportedAudioFormats) {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录不存在: ${directoryPath}`);
    }
    
    const files = fs.readdirSync(directoryPath);
    const matchingFiles = files
      .filter(file => extensions.includes(path.extname(file).toLowerCase()))
      .map(file => path.join(directoryPath, file));
    
    return matchingFiles;
  }

  validateAudioFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!config.supportedAudioFormats.includes(ext)) {
      return {
        valid: false,
        reason: `不支持的文件格式: ${ext}`
      };
    }
    
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        reason: '文件不存在'
      };
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return {
        valid: false,
        reason: '文件为空 (0字节)'
      };
    }
    
    if (stats.size > 0 && stats.size < 10) {
      return {
        valid: false,
        reason: `文件过小 (${stats.size}字节)，可能损坏`
      };
    }
    
    return { valid: true };
  }

  validateAndFilterFiles(filePaths) {
    const validFiles = [];
    const invalidFiles = [];
    
    for (const filePath of filePaths) {
      const validation = this.validateAudioFile(filePath);
      if (validation.valid) {
        validFiles.push(filePath);
      } else {
        invalidFiles.push({
          filePath,
          fileName: path.basename(filePath),
          reason: validation.reason
        });
      }
    }
    
    return { validFiles, invalidFiles };
  }

  getSummary() {
    const total = this.results.length;
    const success = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    
    return {
      total,
      success,
      failed,
      successRate: total > 0 ? ((success / total) * 100).toFixed(1) : 0
    };
  }

  getFailedFiles() {
    return this.errors.map(e => ({
      fileName: e.fileName,
      filePath: e.filePath,
      error: e.error
    }));
  }
}

module.exports = BatchProcessor;
