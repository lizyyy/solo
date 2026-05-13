const { getConfigPath } = require('../utils/path');
const { readJSON, writeJSON } = require('../utils/fs');

class ConfigStore {
  constructor() {
    this.filePath = getConfigPath();
  }

  get() {
    return readJSON(this.filePath, {
      initialized: false,
      defaultConsumerType: 'mock',
      mockConsumer: {
        delay: 100,
        errorRate: 0
      },
      version: '1.0.0'
    });
  }

  save(config) {
    writeJSON(this.filePath, config);
    return config;
  }

  update(updates) {
    const current = this.get();
    const updated = { ...current, ...updates };
    writeJSON(this.filePath, updated);
    return updated;
  }

  isInitialized() {
    return this.get().initialized === true;
  }

  markInitialized() {
    return this.update({ initialized: true });
  }
}

module.exports = ConfigStore;
