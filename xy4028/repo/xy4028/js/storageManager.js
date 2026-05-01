/**
 * 训练记录存储模块
 * 管理浏览器本地存储中的训练记录
 */

import coachConfig from './coachConfig.js';

const STORAGE_KEY = 'cprTrainer_history';

class StorageManager {
  constructor() {
    this.history = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('无法从本地存储加载历史记录:', e);
    }
    return [];
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.warn('无法保存历史记录到本地存储:', e);
    }
  }

  addRecord(scoreData, sessionConfig) {
    const record = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      score: scoreData,
      config: {
        targetBPMLow: coachConfig.get('targetBPMLow'),
        targetBPMHigh: coachConfig.get('targetBPMHigh'),
        errorToleranceMs: coachConfig.get('errorToleranceMs'),
        ...sessionConfig
      }
    };

    this.history.unshift(record);

    const limit = coachConfig.get('historyLimit');
    if (this.history.length > limit) {
      this.history = this.history.slice(0, limit);
    }

    this.save();
    return record;
  }

  getHistory() {
    return [...this.history];
  }

  getRecent(limit = 10) {
    return this.history.slice(0, limit);
  }

  getById(id) {
    return this.history.find(r => r.id === id);
  }

  deleteRecord(id) {
    const index = this.history.findIndex(r => r.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  clearAll() {
    this.history = [];
    this.save();
  }

  getStatistics() {
    if (this.history.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        bestScore: 0,
        averageBPM: 0,
        totalPresses: 0
      };
    }

    const scores = this.history.map(r => r.score.overallScore);
    const bpms = this.history.map(r => r.score.averageBPM).filter(b => b > 0);
    const presses = this.history.reduce((sum, r) => sum + r.score.totalPresses, 0);

    return {
      totalSessions: this.history.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      bestScore: Math.max(...scores),
      averageBPM: bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0,
      totalPresses: presses
    };
  }
}

export default new StorageManager();
