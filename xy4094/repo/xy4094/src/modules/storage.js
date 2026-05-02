export class LocalStorage {
  constructor() {
    this.prefix = 'wind_field_blackbox_';
    this.maxSessions = 10;
    this.checkAvailability();
  }

  checkAvailability() {
    try {
      const testKey = this.prefix + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.available = true;
    } catch (e) {
      console.warn('LocalStorage is not available:', e);
      this.available = false;
    }
    return this.available;
  }

  isAvailable() {
    return this.available;
  }

  setItem(key, value) {
    if (!this.available) return false;
    
    try {
      const storageKey = this.prefix + key;
      const serialized = JSON.stringify(value);
      localStorage.setItem(storageKey, serialized);
      return true;
    } catch (e) {
      console.error('Failed to set localStorage item:', e);
      if (e.name === 'QuotaExceededError') {
        this.cleanupOldSessions();
        try {
          const storageKey = this.prefix + key;
          const serialized = JSON.stringify(value);
          localStorage.setItem(storageKey, serialized);
          return true;
        } catch (e2) {
          console.error('Failed to save after cleanup:', e2);
        }
      }
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    if (!this.available) return defaultValue;
    
    try {
      const storageKey = this.prefix + key;
      const serialized = localStorage.getItem(storageKey);
      
      if (serialized === null) {
        return defaultValue;
      }
      
      return JSON.parse(serialized);
    } catch (e) {
      console.error('Failed to get localStorage item:', e);
      return defaultValue;
    }
  }

  removeItem(key) {
    if (!this.available) return false;
    
    try {
      const storageKey = this.prefix + key;
      localStorage.removeItem(storageKey);
      return true;
    } catch (e) {
      console.error('Failed to remove localStorage item:', e);
      return false;
    }
  }

  clear() {
    if (!this.available) return false;
    
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      
      return true;
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
      return false;
    }
  }

  saveSession(sessionData, options = {}) {
    const sessions = this.getItem('sessions', []);
    
    const session = {
      id: options.id || this.generateId(),
      name: options.name || `会话 ${new Date().toLocaleString('zh-CN')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: sessionData,
      metadata: {
        trackPointCount: sessionData.track?.pointCount || 0,
        weatherRecordCount: sessionData.weather?.recordCount || 0,
        noFlyZoneCount: sessionData.noFlyZones?.featureCount || 0,
        alertPointCount: sessionData.alerts?.featureCount || 0
      }
    };
    
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      session.createdAt = sessions[existingIndex].createdAt;
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    
    if (sessions.length > this.maxSessions) {
      sessions.splice(this.maxSessions);
    }
    
    return this.setItem('sessions', sessions) ? session : null;
  }

  loadSession(sessionId) {
    const sessions = this.getItem('sessions', []);
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
      return session.data;
    }
    
    return null;
  }

  deleteSession(sessionId) {
    const sessions = this.getItem('sessions', []);
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index >= 0) {
      sessions.splice(index, 1);
      return this.setItem('sessions', sessions);
    }
    
    return false;
  }

  listSessions() {
    return this.getItem('sessions', []);
  }

  getLatestSession() {
    const sessions = this.getItem('sessions', []);
    if (sessions.length > 0) {
      return sessions[0];
    }
    return null;
  }

  cleanupOldSessions() {
    const sessions = this.getItem('sessions', []);
    const keepCount = Math.floor(this.maxSessions / 2);
    
    if (sessions.length > keepCount) {
      sessions.splice(keepCount);
      this.setItem('sessions', sessions);
    }
  }

  saveSettings(settings) {
    const currentSettings = this.getItem('settings', {});
    const updated = { ...currentSettings, ...settings };
    return this.setItem('settings', updated);
  }

  loadSettings() {
    return this.getItem('settings', {});
  }

  saveLastImport(filesInfo) {
    return this.setItem('lastImport', {
      timestamp: Date.now(),
      files: filesInfo
    });
  }

  getLastImport() {
    return this.getItem('lastImport', null);
  }

  setCurrentSessionId(sessionId) {
    return this.setItem('currentSessionId', sessionId);
  }

  getCurrentSessionId() {
    return this.getItem('currentSessionId', null);
  }

  getUsedSpace() {
    if (!this.available) return 0;
    
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        total += key.length + (value ? value.length : 0);
      }
    }
    
    return total;
  }

  getStorageInfo() {
    if (!this.available) {
      return { available: false };
    }
    
    const sessions = this.getItem('sessions', []);
    const usedSpace = this.getUsedSpace();
    
    return {
      available: true,
      sessionCount: sessions.length,
      maxSessions: this.maxSessions,
      usedBytes: usedSpace,
      usedKB: (usedSpace / 1024).toFixed(2),
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        metadata: s.metadata
      }))
    };
  }

  generateId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  exportAllData() {
    if (!this.available) return null;
    
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        try {
          data[key.slice(this.prefix.length)] = JSON.parse(value);
        } catch (e) {
          data[key.slice(this.prefix.length)] = value;
        }
      }
    }
    
    return data;
  }

  importAllData(data) {
    if (!this.available) return false;
    
    try {
      for (const [key, value] of Object.entries(data)) {
        this.setItem(key, value);
      }
      return true;
    } catch (e) {
      console.error('Failed to import all data:', e);
      return false;
    }
  }
}

export default LocalStorage;
