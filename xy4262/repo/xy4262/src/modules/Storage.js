export class Storage {
  constructor() {
    this.prefix = 'drone_sim_';
  }

  save(key, data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(this.prefix + key, json);
      return true;
    } catch (error) {
      console.error('保存到localStorage失败:', error);
      return false;
    }
  }

  load(key, defaultValue = null) {
    try {
      const json = localStorage.getItem(this.prefix + key);
      if (json === null) {
        return defaultValue;
      }
      return JSON.parse(json);
    } catch (error) {
      console.error('从localStorage加载失败:', error);
      return defaultValue;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('从localStorage移除失败:', error);
      return false;
    }
  }

  clear() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
      keys.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('清除localStorage失败:', error);
      return false;
    }
  }

  getAllKeys() {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(this.prefix))
        .map(k => k.slice(this.prefix.length));
    } catch (error) {
      console.error('获取所有key失败:', error);
      return [];
    }
  }

  saveSession(sessionData) {
    return this.save('last_session', sessionData);
  }

  loadSession() {
    return this.load('last_session', null);
  }

  saveSettings(settings) {
    return this.save('settings', settings);
  }

  loadSettings() {
    return this.load('settings', {
      collisionDistance: 3,
      warningDistance: 10,
      lowBatteryThreshold: 20,
      playbackSpeed: 1
    });
  }
}
