class HistoryManager {
  constructor(storageKey = 'flood_sandbox_history') {
    this.storageKey = storageKey;
    this.records = this.loadRecords();
  }

  loadRecords() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('加载历史记录失败:', e);
      return [];
    }
  }

  saveRecords() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.records));
      return true;
    } catch (e) {
      console.error('保存历史记录失败:', e);
      return false;
    }
  }

  saveGameRecord(gameData) {
    const record = {
      id: Utils.generateId(),
      ...gameData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOldCaliber: false
    };
    this.records.unshift(record);
    this.saveRecords();
    return record;
  }

  importOldRecord(oldData, source = '老师错题本') {
    const record = {
      id: Utils.generateId(),
      ...oldData,
      createdAt: oldData.createdAt || Date.now(),
      updatedAt: Date.now(),
      isOldCaliber: true,
      source
    };
    this.records.unshift(record);
    this.saveRecords();
    return record;
  }

  getRecordById(id) {
    return this.records.find(r => r.id === id);
  }

  getRecords(filters = {}) {
    let result = [...this.records];

    if (filters.levelId) {
      result = result.filter(r => r.levelId === filters.levelId);
    }

    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }

    if (filters.isOldCaliber !== undefined) {
      result = result.filter(r => r.isOldCaliber === filters.isOldCaliber);
    }

    if (filters.playerName) {
      result = result.filter(r => r.playerName && r.playerName.includes(filters.playerName));
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  updateRecordStatus(id, status, note = '') {
    const record = this.getRecordById(id);
    if (record) {
      record.status = status;
      record.updatedAt = Date.now();
      if (note) {
        record.reviewNote = note;
      }
      this.saveRecords();
      return record;
    }
    return null;
  }

  markAsReviewed(id, reviewer, note = '') {
    return this.updateRecordStatus(id, 'reviewed', note);
  }

  deleteRecord(id) {
    const index = this.records.findIndex(r => r.id === id);
    if (index !== -1) {
      const deleted = this.records.splice(index, 1);
      this.saveRecords();
      return deleted[0];
    }
    return null;
  }

  clearAllRecords() {
    this.records = [];
    this.saveRecords();
  }

  getStatistics() {
    const total = this.records.length;
    const normal = this.records.filter(r => r.status === 'normal').length;
    const needsReview = this.records.filter(r => r.status === 'needs_manual_review').length;
    const hasWarnings = this.records.filter(r => r.status === 'has_warnings').length;
    const reviewed = this.records.filter(r => r.status === 'reviewed').length;
    const oldCaliber = this.records.filter(r => r.isOldCaliber).length;

    const avgScore = total > 0
      ? Math.round(this.records.reduce((sum, r) => sum + (r.finalScore || 0), 0) / total)
      : 0;

    return {
      total,
      normal,
      needsReview,
      hasWarnings,
      reviewed,
      oldCaliber,
      avgScore
    };
  }

  exportAll() {
    return JSON.stringify(this.records, null, 2);
  }

  importRecords(jsonData, merge = false) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!Array.isArray(data)) {
        throw new Error('导入数据格式错误');
      }

      if (merge) {
        const existingIds = new Set(this.records.map(r => r.id));
        const newRecords = data.filter(r => !existingIds.has(r.id));
        this.records = [...this.records, ...newRecords];
      } else {
        this.records = data;
      }

      this.saveRecords();
      return { success: true, imported: data.length };
    } catch (e) {
      console.error('导入失败:', e);
      return { success: false, error: e.message };
    }
  }
}
