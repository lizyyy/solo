const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDataPath, readJSON, writeJSON, saveHistory, getHistory } = require('./workspace');

class DataStore {
  constructor() {
    this.types = ['temperature', 'door', 'maintenance', 'batch', 'alerts', 'assessments'];
  }

  list(type) {
    if (!this.types.includes(type)) throw new Error(`无效的数据类型: ${type}`);
    const dir = getDataPath(type);
    if (!fs.existsSync(dir)) return [];
    
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const id = path.basename(f, '.json');
        return this.get(type, id);
      });
  }

  get(type, id) {
    const filePath = getDataPath(type, id);
    if (!fs.existsSync(filePath)) return null;
    return readJSON(filePath, null);
  }

  exists(type, id) {
    const filePath = getDataPath(type, id);
    return fs.existsSync(filePath);
  }

  create(type, data, id = null, operator = 'system') {
    const actualId = id || uuidv4();
    if (this.exists(type, actualId)) {
      throw new Error(`${type} ID ${actualId} 已存在（幂等保护）`);
    }
    
    const record = {
      ...data,
      id: actualId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const filePath = getDataPath(type, actualId);
    writeJSON(filePath, record);
    saveHistory(type, actualId, record, 'create', operator);
    
    return record;
  }

  update(type, id, updates, operator = 'system', requirePrevious = true) {
    const existing = this.get(type, id);
    if (!existing) {
      if (requirePrevious) throw new Error(`${type} ID ${id} 不存在`);
      return this.create(type, { id, ...updates }, id, operator);
    }
    
    const previous = JSON.parse(JSON.stringify(existing));
    const updated = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    
    const filePath = getDataPath(type, id);
    writeJSON(filePath, updated);
    
    saveHistory(type, id, {
      before: previous,
      after: updated,
      diff: this._getDiff(previous, updated)
    }, 'update', operator);
    
    return {
      record: updated,
      diff: this._getDiff(previous, updated)
    };
  }

  _getDiff(before, after) {
    const diff = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    
    keys.forEach(key => {
      if (key === 'updatedAt') return;
      const beforeVal = JSON.stringify(before?.[key]);
      const afterVal = JSON.stringify(after?.[key]);
      if (beforeVal !== afterVal) {
        diff[key] = { before: before?.[key], after: after?.[key] };
      }
    });
    
    return diff;
  }

  history(type, id) {
    return getHistory(type, id);
  }

  findBy(type, predicate) {
    return this.list(type).filter(predicate);
  }

  findOneBy(type, predicate) {
    return this.list(type).find(predicate);
  }
}

module.exports = new DataStore();
