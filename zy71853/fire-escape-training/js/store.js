const FireEscapeStore = (() => {
  const STORAGE_KEY = 'fire_escape_training_records';
  const HISTORY_KEY = 'fire_escape_training_history';
  const CURRENT_USER = () => localStorage.getItem('fire_escape_user') || '操作员';
  const MAX_HISTORY = 5000;

  function _loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function _loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function _generateId() {
    return 'FET-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
  }

  function _addHistory(recordId, action, detail, oldValue, newValue) {
    const history = _loadHistory();
    history.push({
      id: _generateId(),
      recordId,
      action,
      detail,
      oldValue: oldValue != null ? String(oldValue) : null,
      newValue: newValue != null ? String(newValue) : null,
      operator: CURRENT_USER(),
      timestamp: new Date().toISOString()
    });
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    _saveHistory(history);
  }

  function importRecords(data, source) {
    const records = _loadRecords();
    const existingIds = new Set(records.map(r => r.externalId).filter(Boolean));
    let added = 0;
    let skipped = 0;
    const seenInBatch = new Set();

    const newRecords = data.map(item => {
      if (item.externalId) {
        if (existingIds.has(item.externalId) || seenInBatch.has(item.externalId)) {
          skipped++;
          return null;
        }
        seenInBatch.add(item.externalId);
      }
      added++;
      const record = {
        id: _generateId(),
        externalId: item.externalId || null,
        className: item.className || '未指定班级',
        studentName: item.studentName || '未指定',
        trainingDate: item.trainingDate || new Date().toISOString().slice(0, 10),
        route: item.route || '默认路线',
        score: item.score != null ? Number(item.score) : null,
        status: 'pending',
        source: source,
        pendingReason: '新导入记录，等待复核',
        createdBy: CURRENT_USER(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: CURRENT_USER()
      };
      _addHistory(record.id, 'create', '记录创建', null, 'pending');
      return record;
    }).filter(Boolean);

    const merged = records.concat(newRecords);
    _saveRecords(merged);
    return { added, skipped, total: merged.length };
  }

  function getRecords(filter) {
    let records = _loadRecords();
    if (filter) {
      if (filter.status && filter.status !== 'all') {
        records = records.filter(r => r.status === filter.status);
      }
      if (filter.className && filter.className !== 'all') {
        records = records.filter(r => r.className === filter.className);
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        records = records.filter(r =>
          r.studentName.toLowerCase().includes(s) ||
          r.className.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          (r.externalId && r.externalId.toLowerCase().includes(s))
        );
      }
      if (filter.dateFrom) {
        records = records.filter(r => r.trainingDate >= filter.dateFrom);
      }
      if (filter.dateTo) {
        records = records.filter(r => r.trainingDate <= filter.dateTo);
      }
    }
    return records;
  }

  function getRecordById(id) {
    return _loadRecords().find(r => r.id === id) || null;
  }

  function updateRecord(id, updates, reason) {
    const records = _loadRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const oldRecord = { ...records[idx] };
    const allowedFields = ['className', 'studentName', 'trainingDate', 'route', 'score', 'status', 'pendingReason'];
    const changes = {};

    for (const key of allowedFields) {
      if (updates[key] !== undefined && updates[key] !== oldRecord[key]) {
        changes[key] = { old: oldRecord[key], new: updates[key] };
        records[idx][key] = updates[key];
      }
    }

    if (Object.keys(changes).length === 0) return records[idx];

    records[idx].updatedAt = new Date().toISOString();
    records[idx].updatedBy = CURRENT_USER();

    for (const [field, change] of Object.entries(changes)) {
      _addHistory(id, 'update', `${field}变更: ${reason || '无说明'}`, change.old, change.new);
    }

    _saveRecords(records);
    return records[idx];
  }

  function batchUpdate(ids, updates, reason) {
    const results = [];
    for (const id of ids) {
      const result = updateRecord(id, updates, reason);
      if (result) results.push(result);
    }
    return results;
  }

  function transitionStatus(id, newStatus, reason) {
    const validTransitions = {
      pending: ['reviewing', 'corrected'],
      reviewing: ['approved', 'corrected', 'pending'],
      corrected: ['reviewing', 'approved'],
      approved: ['corrected']
    };

    const records = _loadRecords();
    const record = records.find(r => r.id === id);
    if (!record) return { success: false, error: '记录不存在' };

    const allowed = validTransitions[record.status] || [];
    if (!allowed.includes(newStatus)) {
      return { success: false, error: `不允许从 ${record.status} 转到 ${newStatus}` };
    }

    const oldStatus = record.status;
    record.status = newStatus;
    record.updatedAt = new Date().toISOString();
    record.updatedBy = CURRENT_USER();

    if (newStatus === 'pending') {
      record.pendingReason = reason || '退回待处理';
    }

    _addHistory(id, 'status_change', `状态变更: ${reason || '无说明'}`, oldStatus, newStatus);
    _saveRecords(records);
    return { success: true, record };
  }

  function batchTransitionStatus(ids, newStatus, reason) {
    const results = { success: [], failed: [] };
    for (const id of ids) {
      const result = transitionStatus(id, newStatus, reason);
      if (result.success) {
        results.success.push(id);
      } else {
        results.failed.push({ id, error: result.error });
      }
    }
    return results;
  }

  function deleteRecord(id, reason) {
    const records = _loadRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;

    _addHistory(id, 'delete', reason || '删除记录', records[idx].status, 'deleted');
    records.splice(idx, 1);
    _saveRecords(records);
    return true;
  }

  function getHistory(recordId) {
    const history = _loadHistory();
    if (recordId) {
      return history.filter(h => h.recordId === recordId);
    }
    return history;
  }

  function getClasses() {
    const records = _loadRecords();
    return [...new Set(records.map(r => r.className))].sort();
  }

  function getStatusCounts() {
    const records = _loadRecords();
    const counts = { pending: 0, reviewing: 0, corrected: 0, approved: 0 };
    records.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });
    return counts;
  }

  function clearAll() {
    _saveRecords([]);
    _saveHistory([]);
  }

  function setUser(name) {
    localStorage.setItem('fire_escape_user', name);
  }

  function getUser() {
    return CURRENT_USER();
  }

  function exportAsJSON(filter) {
    return JSON.stringify(getRecords(filter), null, 2);
  }

  function exportAsCSV(filter) {
    const records = getRecords(filter);
    if (records.length === 0) return '';

    const headers = ['id', 'externalId', 'className', 'studentName', 'trainingDate', 'route', 'score', 'status', 'source', 'pendingReason', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt'];
    const lines = [headers.join(',')];

    for (const r of records) {
      const row = headers.map(h => {
        const val = r[h] != null ? String(r[h]) : '';
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? '"' + val.replace(/"/g, '""') + '"'
          : val;
      });
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  function getSnapshot(filter) {
    return {
      filter: { ...filter },
      recordCount: getRecords(filter).length,
      timestamp: new Date().toISOString(),
      statusCounts: getStatusCounts()
    };
  }

  return {
    importRecords,
    getRecords,
    getRecordById,
    updateRecord,
    batchUpdate,
    transitionStatus,
    batchTransitionStatus,
    deleteRecord,
    getHistory,
    getClasses,
    getStatusCounts,
    clearAll,
    setUser,
    getUser,
    exportAsJSON,
    exportAsCSV,
    getSnapshot
  };
})();
