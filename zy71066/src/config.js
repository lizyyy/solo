const defaultConfig = require('../config/default');
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = { ...defaultConfig };
  }

  load(customConfigPath = null) {
    if (customConfigPath && fs.existsSync(customConfigPath)) {
      try {
        const customConfig = require(path.resolve(customConfigPath));
        this.mergeConfig(customConfig);
      } catch (e) {
        throw new Error(`加载配置文件失败: ${e.message}`);
      }
    }
    return this.config;
  }

  mergeConfig(customConfig) {
    const merge = (target, source) => {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    merge(this.config, customConfig);
  }

  get(key = null) {
    if (!key) return this.config;
    return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
      obj[k] = obj[k] || {};
      return obj[k];
    }, this.config);
    target[lastKey] = value;
  }
}

module.exports = new ConfigManager();
