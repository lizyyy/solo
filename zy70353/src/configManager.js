const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(options = {}) {
    this.snapshotFile = options.snapshotFile || null;
    this.eventsFile = options.eventsFile || null;
    this.snapshot = null;
    this.events = [];
    this.versions = [];
    this.frozenKeys = new Set();
  }

  loadSnapshot(filePath) {
    this.snapshotFile = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');
    this.snapshot = JSON.parse(content);
    if (this.snapshot.frozen) {
      this.frozenKeys = new Set(Object.keys(this.snapshot.frozen));
    }
    return this.snapshot;
  }

  loadEvents(filePath) {
    this.eventsFile = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    this.events = Array.isArray(data) ? data : data.events || [];
    this.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return this.events;
  }

  buildVersions() {
    if (!this.snapshot) {
      throw new Error('请先加载配置快照');
    }

    this.versions = [];
    let currentConfig = JSON.parse(JSON.stringify(this.snapshot.config || this.snapshot));
    let versionId = 0;

    this.versions.push({
      id: versionId++,
      timestamp: this.snapshot.timestamp || new Date(0).toISOString(),
      config: JSON.parse(JSON.stringify(currentConfig)),
      changes: [],
      isSnapshot: true
    });

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      const changes = this._applyEvent(currentConfig, event);
      
      if (changes.length > 0) {
        this.versions.push({
          id: versionId++,
          timestamp: event.timestamp,
          config: JSON.parse(JSON.stringify(currentConfig)),
          changes: changes,
          event: event,
          isSnapshot: false
        });
      }
    }

    return this.versions;
  }

  _applyEvent(config, event) {
    const changes = [];

    if (event.type === 'SET' || event.type === 'UPDATE') {
      for (const key of Object.keys(event.data || {})) {
        if (this.frozenKeys.has(key)) {
          continue;
        }
        const oldValue = this._getNestedValue(config, key);
        const newValue = event.data[key];
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          this._setNestedValue(config, key, newValue);
          changes.push({
            key,
            oldValue,
            newValue,
            action: event.type
          });
        }
      }
    } else if (event.type === 'DELETE') {
      for (const key of event.keys || []) {
        if (this.frozenKeys.has(key)) {
          continue;
        }
        const oldValue = this._getNestedValue(config, key);
        if (oldValue !== undefined) {
          this._deleteNestedValue(config, key);
          changes.push({
            key,
            oldValue,
            newValue: undefined,
            action: 'DELETE'
          });
        }
      }
    }

    return changes;
  }

  _getNestedValue(obj, keyPath) {
    const keys = keyPath.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  _setNestedValue(obj, keyPath, value) {
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  _deleteNestedValue(obj, keyPath) {
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) return;
      current = current[key];
    }
    delete current[keys[keys.length - 1]];
  }

  getVersion(versionId) {
    return this.versions[versionId] || null;
  }

  getVersions() {
    return this.versions;
  }

  isKeyFrozen(key) {
    return this.frozenKeys.has(key);
  }

  getFrozenKeys() {
    return Array.from(this.frozenKeys);
  }

  getVersionCount() {
    return this.versions.length;
  }
}

module.exports = ConfigManager;
