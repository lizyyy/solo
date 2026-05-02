const Storage = {
  KEYS: {
    HISTORY: 'webrtc_ft_history',
    LOGS: 'webrtc_ft_logs',
    SETTINGS: 'webrtc_ft_settings'
  },

  MAX_HISTORY: 50,
  MAX_LOGS: 200,

  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage set error:', e);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage remove error:', e);
    }
  },

  getHistory() {
    return this.get(this.KEYS.HISTORY) || [];
  },

  addHistory(historyItem) {
    const history = this.getHistory();
    const item = {
      id: Utils.generateId(),
      ...historyItem,
      createdAt: Date.now()
    };
    history.unshift(item);
    
    if (history.length > this.MAX_HISTORY) {
      history.splice(this.MAX_HISTORY);
    }
    
    this.set(this.KEYS.HISTORY, history);
    return item;
  },

  updateHistory(id, updates) {
    const history = this.getHistory();
    const index = history.findIndex(item => item.id === id);
    if (index !== -1) {
      history[index] = {
        ...history[index],
        ...updates,
        updatedAt: Date.now()
      };
      this.set(this.KEYS.HISTORY, history);
    }
  },

  clearHistory() {
    this.remove(this.KEYS.HISTORY);
  },

  getLogs() {
    return this.get(this.KEYS.LOGS) || [];
  },

  addLog(level, message) {
    const logs = this.getLogs();
    const log = {
      id: Utils.generateId(),
      level: level || 'info',
      message,
      timestamp: Date.now()
    };
    logs.push(log);
    
    if (logs.length > this.MAX_LOGS) {
      logs.splice(0, logs.length - this.MAX_LOGS);
    }
    
    this.set(this.KEYS.LOGS, logs);
    return log;
  },

  clearLogs() {
    this.remove(this.KEYS.LOGS);
  },

  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      chunkSize: 16 * 1024,
      autoDownload: true
    };
  },

  saveSettings(settings) {
    this.set(this.KEYS.SETTINGS, {
      ...this.getSettings(),
      ...settings
    });
  }
};

window.Storage = Storage;
