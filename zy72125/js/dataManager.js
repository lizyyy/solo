const STORAGE_KEY = 'tour_stage_input_data_v1';
const HISTORY_KEY = 'tour_stage_input_history_v1';
const CURRENT_USER_KEY = 'tour_stage_current_user';

const INPUT_TYPES = [
  '主唱麦', '和声麦', '吉他', '贝斯', '鼓组', '键盘',
  '弦乐', '管乐', '旁白', '环境音', 'Program', '其他'
];

const SOURCE_TYPES = [
  '微信群截图', 'QQ群截图', '邮件', '文件夹',
  '录音师备注', '演出方提供', '现场补录', '其他来源'
];

const STATUS_TYPES = ['待核对', '正常', '有疑问', '缺材料', '已确认'];

const DataManager = {
  records: [],
  history: [],
  currentUser: '老许',
  snapshotBeforeEdit: null,

  init() {
    this.load();
    this.loadHistory();
    this.loadCurrentUser();
  },

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      this.records = data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('加载数据失败:', e);
      this.records = [];
    }
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
  },

  loadHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      this.history = data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('加载历史记录失败:', e);
      this.history = [];
    }
  },

  saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
  },

  loadCurrentUser() {
    const user = localStorage.getItem(CURRENT_USER_KEY);
    if (user) {
      this.currentUser = user;
    }
  },

  setCurrentUser(user) {
    this.currentUser = user || '老许';
    localStorage.setItem(CURRENT_USER_KEY, this.currentUser);
  },

  generateId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  getEmptyRecord() {
    const now = new Date().toISOString();
    return {
      id: this.generateId(),
      performanceDate: '',
      city: '',
      venue: '',
      songName: '',
      inputType: '',
      channelNumber: '',
      fileName: '',
      fileFormat: '',
      duration: '',
      durationSeconds: 0,
      sourceType: '',
      sourceDetail: '',
      remark: '',
      status: '待核对',
      issues: [],
      suggestions: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: this.currentUser,
      isDeleted: false
    };
  },

  addRecord(record, skipHistory = false) {
    const newRecord = {
      ...this.getEmptyRecord(),
      ...record,
      id: this.generateId(),
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: this.currentUser,
      issues: [],
      suggestions: []
    };

    this.records.push(newRecord);
    this.save();

    if (!skipHistory) {
      this.addHistory(newRecord.id, '新增', null, newRecord);
    }

    return newRecord;
  },

  updateRecord(id, updates, skipHistory = false) {
    const index = this.records.findIndex(r => r.id === id);
    if (index === -1) return null;

    const oldRecord = JSON.parse(JSON.stringify(this.records[index]));

    const newVersion = (oldRecord.version || 1) + 1;
    const now = new Date().toISOString();

    const newRecord = {
      ...oldRecord,
      ...updates,
      version: newVersion,
      updatedAt: now,
      updatedBy: this.currentUser
    };

    this.records[index] = newRecord;
    this.save();

    if (!skipHistory) {
      this.addHistory(id, '修改', oldRecord, newRecord);
    }

    return newRecord;
  },

  deleteRecord(id, skipHistory = false) {
    const index = this.records.findIndex(r => r.id === id);
    if (index === -1) return false;

    const oldRecord = this.records[index];

    if (!skipHistory) {
      this.addHistory(id, '删除', oldRecord, null);
    }

    this.records.splice(index, 1);
    this.save();

    return true;
  },

  getRecord(id) {
    return this.records.find(r => r.id === id);
  },

  getAllRecords() {
    return this.records.filter(r => !r.isDeleted);
  },

  addHistory(recordId, action, oldData, newData) {
    const changes = this.calculateChanges(oldData, newData);

    const historyEntry = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      recordId,
      action,
      user: this.currentUser,
      timestamp: new Date().toISOString(),
      version: newData ? newData.version : (oldData ? oldData.version : 1),
      changes,
      oldData: oldData ? this.stripLargeData(oldData) : null,
      newData: newData ? this.stripLargeData(newData) : null
    };

    this.history.unshift(historyEntry);

    if (this.history.length > 500) {
      this.history = this.history.slice(0, 500);
    }

    this.saveHistory();
  },

  stripLargeData(data) {
    if (!data) return null;
    const stripped = { ...data };
    if (stripped.suggestions && stripped.suggestions.length > 3) {
      stripped.suggestions = stripped.suggestions.slice(0, 3);
    }
    return stripped;
  },

  calculateChanges(oldData, newData) {
    if (!oldData || !newData) return [];

    const fieldsToCheck = [
      'performanceDate', 'city', 'venue', 'songName', 'inputType',
      'channelNumber', 'fileName', 'fileFormat', 'duration',
      'sourceType', 'sourceDetail', 'remark', 'status'
    ];

    const changes = [];
    const fieldLabels = {
      performanceDate: '演出日期',
      city: '城市',
      venue: '场地',
      songName: '曲目名称',
      inputType: '输入类型',
      channelNumber: '通道号',
      fileName: '文件名',
      fileFormat: '文件格式',
      duration: '时长',
      sourceType: '来源类型',
      sourceDetail: '来源详情',
      remark: '备注',
      status: '状态'
    };

    for (const field of fieldsToCheck) {
      const oldVal = oldData[field];
      const newVal = newData[field];

      if (oldVal !== newVal) {
        changes.push({
          field,
          fieldLabel: fieldLabels[field] || field,
          oldValue: oldVal || '(空)',
          newValue: newVal || '(空)'
        });
      }
    }

    return changes;
  },

  getHistoryForRecord(recordId) {
    return this.history.filter(h => h.recordId === recordId);
  },

  getAllHistory() {
    return this.history;
  },

  clearAllData() {
    this.records = [];
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  },

  exportData(records = null) {
    const dataToExport = records || this.records;
    return {
      exportTime: new Date().toISOString(),
      exportedBy: this.currentUser,
      version: '1.0',
      recordCount: dataToExport.length,
      records: dataToExport
    };
  },

  importData(jsonData, mergeMode = 'add') {
    let data;
    if (typeof jsonData === 'string') {
      data = JSON.parse(jsonData);
    } else {
      data = jsonData;
    }

    const importedRecords = data.records || data;

    if (!Array.isArray(importedRecords)) {
      throw new Error('导入的数据格式不正确');
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of importedRecords) {
      const existing = record.id ? this.records.find(r => r.id === record.id) : null;

      if (existing) {
        if (mergeMode === 'skip') {
          skipped++;
          continue;
        } else if (mergeMode === 'add') {
          const newRecord = this.addRecord(record, true);
          added++;
          this.addHistory(newRecord.id, '导入新增', null, newRecord);
        } else if (mergeMode === 'overwrite') {
          if ((existing.version || 1) > (record.version || 1)) {
            skipped++;
            continue;
          }
          this.updateRecord(existing.id, record, true);
          updated++;
          this.addHistory(existing.id, '导入覆盖', existing, record);
        }
      } else {
        const newRecord = this.addRecord(record, true);
        added++;
        this.addHistory(newRecord.id, '导入新增', null, newRecord);
      }
    }

    return { added, updated, skipped };
  },

  takeSnapshot() {
    this.snapshotBeforeEdit = JSON.stringify(this.records);
  },

  compareSnapshot() {
    if (!this.snapshotBeforeEdit) return null;

    const oldRecords = JSON.parse(this.snapshotBeforeEdit);
    const newRecords = this.records;

    const oldMap = new Map(oldRecords.map(r => [r.id, r]));
    const newMap = new Map(newRecords.map(r => [r.id, r]));

    const diff = {
      added: [],
      modified: [],
      deleted: []
    };

    for (const [id, newRec] of newMap) {
      if (!oldMap.has(id)) {
        diff.added.push(newRec);
      } else {
        const oldRec = oldMap.get(id);
        const changes = this.calculateChanges(oldRec, newRec);
        if (changes.length > 0) {
          diff.modified.push({ id, old: oldRec, new: newRec, changes });
        }
      }
    }

    for (const [id, oldRec] of oldMap) {
      if (!newMap.has(id)) {
        diff.deleted.push(oldRec);
      }
    }

    return diff;
  },

  batchAddRecords(records) {
    this.takeSnapshot();

    const results = [];
    for (const record of records) {
      results.push(this.addRecord(record, true));
    }

    this.save();

    for (const record of results) {
      this.addHistory(record.id, '批量新增', null, record);
    }

    return results;
  },

  updateRecordIssues(id, issues, suggestions) {
    return this.updateRecord(id, {
      issues,
      suggestions,
      status: issues.length > 0 ? (issues.some(i => i.type === '空值') ? '缺材料' : '有疑问') : '正常'
    }, true);
  },

  parseDuration(durationStr) {
    if (!durationStr) return 0;

    const parts = durationStr.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else {
      return parseFloat(durationStr) || 0;
    }
  },

  formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  }
};
