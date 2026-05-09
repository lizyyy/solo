const fs = require('fs');
const path = require('path');

const DEFAULT_RULES = [
  {
    id: 'rule-night-1',
    property_id: null,
    rule_name: '夜间高峰噪音（22:00-06:00）≥65分贝持续5分钟',
    db_threshold: 65,
    time_slot_start: '22:00',
    time_slot_end: '06:00',
    duration_threshold_seconds: 300,
    compensation_type: 'percent',
    compensation_value: 30,
    is_active: 1,
    priority: 10
  },
  {
    id: 'rule-night-2',
    property_id: null,
    rule_name: '夜间高峰噪音（22:00-06:00）≥75分贝持续3分钟',
    db_threshold: 75,
    time_slot_start: '22:00',
    time_slot_end: '06:00',
    duration_threshold_seconds: 180,
    compensation_type: 'percent',
    compensation_value: 50,
    is_active: 1,
    priority: 20
  },
  {
    id: 'rule-day-1',
    property_id: null,
    rule_name: '日间噪音（06:00-22:00）≥70分贝持续10分钟',
    db_threshold: 70,
    time_slot_start: '06:00',
    time_slot_end: '22:00',
    duration_threshold_seconds: 600,
    compensation_type: 'percent',
    compensation_value: 20,
    is_active: 1,
    priority: 5
  },
  {
    id: 'rule-neighbor-1',
    property_id: null,
    rule_name: '邻居投诉+验证证据+持续≥5分钟',
    db_threshold: 60,
    time_slot_start: null,
    time_slot_end: null,
    duration_threshold_seconds: 300,
    compensation_type: 'fixed',
    compensation_value: 200,
    is_active: 1,
    priority: 15
  }
];

class MemoryDb {
  constructor() {
    this.orders = new Map();
    this.decibel_records = new Map();
    this.complaints = new Map();
    this.evidence_segments = new Map();
    this.compensation_rules = new Map();
    this.process_history = new Map();
    this.idempotency_records = new Map();

    const now = new Date().toISOString();
    for (const rule of DEFAULT_RULES) {
      this.compensation_rules.set(rule.id, {
        ...rule,
        created_at: now,
        updated_at: now
      });
    }

    console.log('已初始化内存数据库，包含', this.compensation_rules.size, '条默认赔付规则');
  }

  prepare(sql) {
    const trimmed = sql.trim();

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('select')) {
      return this._createSelect(sql);
    }
    if (trimmed.startsWith('INSERT') || trimmed.startsWith('insert')) {
      return this._createInsert(sql);
    }
    if (trimmed.startsWith('UPDATE') || trimmed.startsWith('update')) {
      return this._createUpdate(sql);
    }
    if (trimmed.startsWith('DELETE') || trimmed.startsWith('delete')) {
      return this._createDelete(sql);
    }

    console.warn('Unsupported SQL:', sql);
    return {
      get: () => undefined,
      all: () => [],
      run: () => ({ changes: 0 })
    };
  }

  _createSelect(sql) {
    const self = this;
    return {
      get(...params) {
        const result = self._executeSelect(sql, params);
        return result[0];
      },
      all(...params) {
        return self._executeSelect(sql, params);
      }
    };
  }

  _createInsert(sql) {
    const self = this;
    return {
      run(...params) {
        return self._executeInsert(sql, params);
      }
    };
  }

  _createUpdate(sql) {
    const self = this;
    return {
      run(...params) {
        return self._executeUpdate(sql, params);
      }
    };
  }

  _createDelete(sql) {
    const self = this;
    return {
      run(...params) {
        return self._executeDelete(sql, params);
      }
    };
  }

  _executeSelect(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];
    const tableName = tableMatch[1];

    const table = this._getTable(tableName);
    if (!table) return [];

    let items = Array.from(table.values());

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|GROUP BY|$)/i);
    if (whereMatch) {
      items = this._applyWhere(items, whereMatch[1], params);
    }

    const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/i);
    if (orderMatch) {
      items = this._applyOrderBy(items, orderMatch[1]);
    }

    return items;
  }

  _executeInsert(sql, params) {
    const tableMatch = sql.match(/INTO\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1];

    const table = this._getTable(tableName);
    if (!table) return { changes: 0 };

    const colsMatch = sql.match(/\(([^)]+)\)/);
    if (!colsMatch) return { changes: 0 };
    const columns = colsMatch[1].split(',').map(c => c.trim());

    const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
    if (!valuesMatch) return { changes: 0 };
    const placeholders = valuesMatch[1].split(',').map(c => c.trim());

    const obj = {};
    let paramIndex = 0;
    columns.forEach((col, i) => {
      const ph = placeholders[i];
      if (ph === '?') {
        obj[col] = params[paramIndex++];
      } else if (ph.toUpperCase() === 'NULL') {
        obj[col] = null;
      } else if (ph.startsWith("'") && ph.endsWith("'")) {
        obj[col] = ph.slice(1, -1);
      } else {
        obj[col] = ph;
      }
    });

    const idField = columns[0];
    const id = obj[idField];
    table.set(id, obj);

    return { changes: 1, lastInsertRowid: id };
  }

  _executeUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1];

    const table = this._getTable(tableName);
    if (!table) return { changes: 0 };

    const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i);
    if (!setMatch) return { changes: 0 };
    const setParts = setMatch[1].split(',').map(p => p.trim());

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|$)/i);

    let items = Array.from(table.values());
    if (whereMatch) {
      items = this._applyWhere(items, whereMatch[1], params);
    }

    let changes = 0;
    let paramIndex = 0;

    const updates = {};
    for (const part of setParts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const field = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      if (value === '?') {
        updates[field] = params[paramIndex++];
      } else if (value.toUpperCase() === 'NULL') {
        updates[field] = null;
      } else if (value.startsWith("'") && value.endsWith("'")) {
        updates[field] = value.slice(1, -1);
      } else {
        updates[field] = value;
      }
    }

    for (const item of items) {
      const idField = this._getIdField(tableName);
      const id = item[idField];
      const existing = table.get(id);
      if (existing) {
        Object.assign(existing, updates);
        table.set(id, existing);
        changes++;
      }
    }

    return { changes };
  }

  _executeDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1];

    const table = this._getTable(tableName);
    if (!table) return { changes: 0 };

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|$)/i);

    let items = Array.from(table.values());
    if (whereMatch) {
      items = this._applyWhere(items, whereMatch[1], params);
    }

    let changes = 0;
    const idField = this._getIdField(tableName);
    for (const item of items) {
      table.delete(item[idField]);
      changes++;
    }

    return { changes };
  }

  _applyWhere(items, whereClause, params) {
    const conditions = this._parseConditions(whereClause);
    let paramIndex = 0;

    return items.filter(item => {
      for (const cond of conditions) {
        const { field, operator, valueRaw } = cond;
        let value = valueRaw;

        if (valueRaw === '?') {
          value = params[paramIndex++];
        } else if (valueRaw.startsWith("'") && valueRaw.endsWith("'")) {
          value = valueRaw.slice(1, -1);
        } else if (valueRaw.toUpperCase() === 'NULL') {
          value = null;
        } else if (!isNaN(Number(valueRaw))) {
          value = Number(valueRaw);
        }

        const itemValue = item[field];

        switch (operator) {
          case '=':
            if (value === null && itemValue === null) continue;
            if (value === null || itemValue === null) return false;
            if (itemValue != value) return false;
            break;
          case '!=':
          case '<>':
            if (value === null && itemValue === null) return false;
            if (value === null || itemValue === null) continue;
            if (itemValue == value) return false;
            break;
          case '>':
            if (itemValue == null) return false;
            if (Number(itemValue) <= Number(value)) return false;
            break;
          case '<':
            if (itemValue == null) return false;
            if (Number(itemValue) >= Number(value)) return false;
            break;
          case '>=':
            if (itemValue == null) return false;
            if (Number(itemValue) < Number(value)) return false;
            break;
          case '<=':
            if (itemValue == null) return false;
            if (Number(itemValue) > Number(value)) return false;
            break;
          case 'LIKE':
            if (itemValue == null || value == null) return false;
            const pattern = String(value).replace(/%/g, '.*');
            if (!new RegExp('^' + pattern + '$', 'i').test(String(itemValue))) return false;
            break;
          case 'IS':
            if (value === null && itemValue !== null) return false;
            if (value !== null && itemValue === null) return false;
            break;
          case 'IS NOT':
            if (value === null && itemValue === null) return false;
            break;
        }
      }
      return true;
    });
  }

  _parseConditions(whereClause) {
    const conditions = [];
    const parts = whereClause.split(/\s+AND\s+/i);

    for (const part of parts) {
      let match = part.match(/(\w+)\s*=\s*(.+)/i);
      if (match) {
        conditions.push({ field: match[1].trim(), operator: '=', valueRaw: match[2].trim() });
        continue;
      }

      match = part.match(/(\w+)\s*(<>|!=)\s*(.+)/i);
      if (match) {
        conditions.push({ field: match[1].trim(), operator: match[2], valueRaw: match[3].trim() });
        continue;
      }

      match = part.match(/(\w+)\s*(>=|<=|>|<)\s*(.+)/i);
      if (match) {
        conditions.push({ field: match[1].trim(), operator: match[2], valueRaw: match[3].trim() });
        continue;
      }

      match = part.match(/(\w+)\s+LIKE\s+(.+)/i);
      if (match) {
        conditions.push({ field: match[1].trim(), operator: 'LIKE', valueRaw: match[2].trim() });
        continue;
      }

      match = part.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/i);
      if (match) {
        conditions.push({
          field: match[1].trim(),
          operator: match[2] ? 'IS NOT' : 'IS',
          valueRaw: 'NULL'
        });
        continue;
      }
    }

    return conditions;
  }

  _applyOrderBy(items, orderClause) {
    const parts = orderClause.split(',').map(p => p.trim());
    const sortFields = [];

    for (const part of parts) {
      const [field, dir] = part.split(/\s+/);
      sortFields.push({ field, dir: (dir || 'asc').toUpperCase() });
    }

    return [...items].sort((a, b) => {
      for (const sf of sortFields) {
        let av = a[sf.field];
        let bv = b[sf.field];

        if (av == null && bv == null) continue;
        if (av == null) return sf.dir === 'ASC' ? -1 : 1;
        if (bv == null) return sf.dir === 'ASC' ? 1 : -1;

        if (typeof av === 'string' && typeof bv === 'string') {
          const cmp = av.localeCompare(bv);
          if (cmp !== 0) return sf.dir === 'ASC' ? cmp : -cmp;
        } else {
          const cmp = Number(av) - Number(bv);
          if (cmp !== 0) return sf.dir === 'ASC' ? cmp : -cmp;
        }
      }
      return 0;
    });
  }

  _getTable(tableName) {
    const map = {
      orders: this.orders,
      decibel_records: this.decibel_records,
      complaints: this.complaints,
      evidence_segments: this.evidence_segments,
      compensation_rules: this.compensation_rules,
      process_history: this.process_history,
      idempotency_records: this.idempotency_records
    };
    return map[tableName];
  }

  _getIdField(tableName) {
    const map = {
      orders: 'id',
      decibel_records: 'id',
      complaints: 'id',
      evidence_segments: 'id',
      compensation_rules: 'id',
      process_history: 'id',
      idempotency_records: 'key'
    };
    return map[tableName] || 'id';
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }

  exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s);
    for (const stmt of statements) {
      if (stmt.startsWith('CREATE TABLE') || stmt.startsWith('create table')) {
        continue;
      }
      if (stmt.startsWith('CREATE INDEX') || stmt.startsWith('create index')) {
        continue;
      }
      this.prepare(stmt).run();
    }
  }

  pragma(_) {}
}

let dbInstance = null;

function initDb(dbPath) {
  if (!dbInstance) {
    dbInstance = new MemoryDb();
  }
  return dbInstance;
}

function getDb() {
  return dbInstance;
}

module.exports = { initDb, getDb };
