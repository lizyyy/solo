const DEFAULT_QUOTAS = {
  maxExecutionTime: 30000,
  maxMemoryMB: 128,
  maxCPUPercent: 50,
  maxFileSizeMB: 10,
  maxLogLines: 1000,
  maxConcurrentTasks: 5
};

const QUOTA_PRESETS = {
  lightweight: {
    name: '轻量任务',
    maxExecutionTime: 10000,
    maxMemoryMB: 64,
    maxCPUPercent: 25,
    maxFileSizeMB: 5,
    maxLogLines: 500
  },
  standard: {
    name: '标准任务',
    maxExecutionTime: 30000,
    maxMemoryMB: 128,
    maxCPUPercent: 50,
    maxFileSizeMB: 10,
    maxLogLines: 1000
  },
  heavy: {
    name: '重型任务',
    maxExecutionTime: 120000,
    maxMemoryMB: 512,
    maxCPUPercent: 80,
    maxFileSizeMB: 50,
    maxLogLines: 5000
  },
  ultra: {
    name: '超重型任务',
    maxExecutionTime: 300000,
    maxMemoryMB: 1024,
    maxCPUPercent: 100,
    maxFileSizeMB: 100,
    maxLogLines: 10000
  }
};

class ResourceQuota {
  constructor(preset = 'standard', customQuotas = null) {
    const baseQuota = QUOTA_PRESETS[preset] || QUOTA_PRESETS.standard;
    this.quotas = { ...DEFAULT_QUOTAS, ...baseQuota };
    
    if (customQuotas) {
      this.quotas = { ...this.quotas, ...customQuotas };
    }
    
    this.preset = preset;
    this.usage = {
      executionTime: 0,
      memoryMB: 0,
      cpuPercent: 0,
      fileSizeMB: 0,
      logLines: 0
    };
    
    this.startTime = null;
    this.isActive = false;
  }

  start() {
    this.startTime = Date.now();
    this.isActive = true;
  }

  stop() {
    if (this.startTime) {
      this.usage.executionTime = Date.now() - this.startTime;
    }
    this.isActive = false;
  }

  getUsage() {
    const currentUsage = { ...this.usage };
    
    if (this.isActive && this.startTime) {
      currentUsage.executionTime = Date.now() - this.startTime;
    }
    
    return currentUsage;
  }

  getQuotas() {
    return { ...this.quotas };
  }

  getPreset() {
    return this.preset;
  }

  updateMemoryUsage(currentMemoryMB) {
    this.usage.memoryMB = currentMemoryMB;
    return this.checkMemoryLimit();
  }

  updateCPUUsage(currentCPUPercent) {
    this.usage.cpuPercent = currentCPUPercent;
    return this.checkCPULimit();
  }

  updateFileSize(fileSizeMB) {
    this.usage.fileSizeMB += fileSizeMB;
    return this.checkFileSizeLimit();
  }

  incrementLogLines(count = 1) {
    this.usage.logLines += count;
    return this.checkLogLinesLimit();
  }

  checkTimeLimit() {
    const usage = this.getUsage();
    
    if (usage.executionTime > this.quotas.maxExecutionTime) {
      return {
        exceeded: true,
        limit: 'executionTime',
        used: usage.executionTime,
        max: this.quotas.maxExecutionTime,
        message: `执行时间超限: ${usage.executionTime}ms > ${this.quotas.maxExecutionTime}ms`
      };
    }
    
    return { exceeded: false };
  }

  checkMemoryLimit() {
    if (this.usage.memoryMB > this.quotas.maxMemoryMB) {
      return {
        exceeded: true,
        limit: 'memoryMB',
        used: this.usage.memoryMB,
        max: this.quotas.maxMemoryMB,
        message: `内存使用超限: ${this.usage.memoryMB}MB > ${this.quotas.maxMemoryMB}MB`
      };
    }
    
    return { exceeded: false };
  }

  checkCPULimit() {
    if (this.usage.cpuPercent > this.quotas.maxCPUPercent) {
      return {
        exceeded: true,
        limit: 'cpuPercent',
        used: this.usage.cpuPercent,
        max: this.quotas.maxCPUPercent,
        message: `CPU使用超限: ${this.usage.cpuPercent}% > ${this.quotas.maxCPUPercent}%`
      };
    }
    
    return { exceeded: false };
  }

  checkFileSizeLimit() {
    if (this.usage.fileSizeMB > this.quotas.maxFileSizeMB) {
      return {
        exceeded: true,
        limit: 'fileSizeMB',
        used: this.usage.fileSizeMB,
        max: this.quotas.maxFileSizeMB,
        message: `文件大小超限: ${this.usage.fileSizeMB}MB > ${this.quotas.maxFileSizeMB}MB`
      };
    }
    
    return { exceeded: false };
  }

  checkLogLinesLimit() {
    if (this.usage.logLines > this.quotas.maxLogLines) {
      return {
        exceeded: true,
        limit: 'logLines',
        used: this.usage.logLines,
        max: this.quotas.maxLogLines,
        message: `日志行数超限: ${this.usage.logLines} > ${this.quotas.maxLogLines}`
      };
    }
    
    return { exceeded: false };
  }

  checkAllLimits() {
    const checks = [
      this.checkTimeLimit(),
      this.checkMemoryLimit(),
      this.checkCPULimit(),
      this.checkFileSizeLimit(),
      this.checkLogLinesLimit()
    ];
    
    const exceeded = checks.filter(c => c.exceeded);
    
    if (exceeded.length > 0) {
      return {
        anyExceeded: true,
        violations: exceeded,
        messages: exceeded.map(e => e.message)
      };
    }
    
    return { anyExceeded: false, violations: [], messages: [] };
  }

  getRemainingTime() {
    if (!this.isActive || !this.startTime) {
      return this.quotas.maxExecutionTime;
    }
    
    const elapsed = Date.now() - this.startTime;
    const remaining = this.quotas.maxExecutionTime - elapsed;
    
    return Math.max(0, remaining);
  }

  getProgress() {
    const usage = this.getUsage();
    
    return {
      executionTime: {
        used: usage.executionTime,
        max: this.quotas.maxExecutionTime,
        percent: Math.min(100, (usage.executionTime / this.quotas.maxExecutionTime) * 100)
      },
      memory: {
        used: usage.memoryMB,
        max: this.quotas.maxMemoryMB,
        percent: Math.min(100, (usage.memoryMB / this.quotas.maxMemoryMB) * 100)
      },
      cpu: {
        used: usage.cpuPercent,
        max: this.quotas.maxCPUPercent,
        percent: Math.min(100, (this.usage.cpuPercent / this.quotas.maxCPUPercent) * 100)
      },
      fileSize: {
        used: usage.fileSizeMB,
        max: this.quotas.maxFileSizeMB,
        percent: Math.min(100, (usage.fileSizeMB / this.quotas.maxFileSizeMB) * 100)
      },
      logLines: {
        used: usage.logLines,
        max: this.quotas.maxLogLines,
        percent: Math.min(100, (usage.logLines / this.quotas.maxLogLines) * 100)
      }
    };
  }

  static getPresets() {
    return JSON.parse(JSON.stringify(QUOTA_PRESETS));
  }

  static getDefaultQuotas() {
    return { ...DEFAULT_QUOTAS };
  }
}

module.exports = {
  ResourceQuota,
  QUOTA_PRESETS,
  DEFAULT_QUOTAS
};
