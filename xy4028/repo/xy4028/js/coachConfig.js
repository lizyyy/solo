/**
 * 教练模式配置模块
 * 管理训练参数的配置和验证
 */

const DEFAULT_CONFIG = {
  targetBPMLow: 100,
  targetBPMHigh: 120,
  errorToleranceMs: 100,
  enableMetronome: true,
  enableMouseClick: true,
  metronomeVolume: 0.7,
  historyLimit: 20
};

class CoachConfig {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.listeners = [];
    this.load();
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    const errors = this.validateSingle(key, value);
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    this.config[key] = value;
    this.save();
    this.notifyListeners();
  }

  update(newConfig) {
    const errors = this.validateAll(newConfig);
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    this.config = { ...this.config, ...newConfig };
    this.save();
    this.notifyListeners();
  }

  validateSingle(key, value) {
    const errors = [];
    
    switch (key) {
      case 'targetBPMLow':
        if (value < 60 || value > 200) {
          errors.push('目标BPM下限应在60-200之间');
        }
        break;
      case 'targetBPMHigh':
        if (value < 60 || value > 200) {
          errors.push('目标BPM上限应在60-200之间');
        }
        if (value < this.config.targetBPMLow) {
          errors.push('目标BPM上限不能低于下限');
        }
        break;
      case 'errorToleranceMs':
        if (value < 50 || value > 500) {
          errors.push('误差容忍应在50-500毫秒之间');
        }
        break;
      case 'metronomeVolume':
        if (value < 0 || value > 1) {
          errors.push('音量应在0-1之间');
        }
        break;
      case 'historyLimit':
        if (value < 1 || value > 100) {
          errors.push('历史记录数应在1-100之间');
        }
        break;
    }
    
    return errors;
  }

  validateAll(config) {
    const errors = [];
    const tempConfig = { ...this.config, ...config };
    
    if (tempConfig.targetBPMHigh < tempConfig.targetBPMLow) {
      errors.push('目标BPM上限不能低于下限');
    }
    
    for (const [key, value] of Object.entries(config)) {
      errors.push(...this.validateSingle(key, value));
    }
    
    return errors;
  }

  reset() {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
    this.notifyListeners();
  }

  save() {
    try {
      localStorage.setItem('cprTrainer_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('无法保存配置到本地存储:', e);
    }
  }

  load() {
    try {
      const saved = localStorage.getItem('cprTrainer_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      console.warn('无法从本地存储加载配置:', e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(l => l(this.config));
  }

  getTargetIntervalMs() {
    const avgBPM = (this.config.targetBPMLow + this.config.targetBPMHigh) / 2;
    return 60000 / avgBPM;
  }

  getValidIntervalRange() {
    const lowInterval = 60000 / this.config.targetBPMHigh;
    const highInterval = 60000 / this.config.targetBPMLow;
    return {
      min: lowInterval - this.config.errorToleranceMs,
      max: highInterval + this.config.errorToleranceMs,
      target: this.getTargetIntervalMs()
    };
  }
}

export default new CoachConfig();
