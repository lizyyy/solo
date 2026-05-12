const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'billing-data.json');

let store = {
  customers: [],
  temperature_zones: [],
  zone_rates: [],
  age_ladders: [],
  operation_ladders: [],
  inventory_snapshots: [],
  operations: [],
  bills: [],
  bill_status_history: [],
  bill_line_items: [],
  bill_age_details: [],
  adjustments: [],
  idempotent_records: []
};

function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      store = JSON.parse(data);
    }
  } catch (error) {
    console.error('加载数据失败，使用空数据:', error.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('保存数据失败:', error.message);
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.conditions = [];
    this.orderByField = null;
    this.orderDirection = 'ASC';
    this.limitCount = null;
  }

  where(field, operator, value) {
    this.conditions.push({ field, operator, value });
    return this;
  }

  orderBy(field, direction = 'ASC') {
    this.orderByField = field;
    this.orderDirection = direction.toUpperCase();
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  _applyConditions(rows) {
    return rows.filter(row => {
      for (const cond of this.conditions) {
        const rowValue = row[cond.field];
        let match = false;
        
        switch (cond.operator) {
          case '=':
            match = rowValue === cond.value;
            break;
          case '!=':
            match = rowValue !== cond.value;
            break;
          case '>':
            match = rowValue > cond.value;
            break;
          case '>=':
            match = rowValue >= cond.value;
            break;
          case '<':
            match = rowValue < cond.value;
            break;
          case '<=':
            match = rowValue <= cond.value;
            break;
          case 'IS NULL':
            match = rowValue === null || rowValue === undefined;
            break;
          case 'IS NOT NULL':
            match = rowValue !== null && rowValue !== undefined;
            break;
          default:
            match = true;
        }
        
        if (!match) return false;
      }
      return true;
    });
  }

  _applyOrdering(rows) {
    if (!this.orderByField) return rows;
    
    return [...rows].sort((a, b) => {
      const aVal = a[this.orderByField];
      const bVal = b[this.orderByField];
      
      if (aVal < bVal) return this.orderDirection === 'ASC' ? -1 : 1;
      if (aVal > bVal) return this.orderDirection === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  _applyLimit(rows) {
    if (this.limitCount === null) return rows;
    return rows.slice(0, this.limitCount);
  }

  all() {
    let rows = store[this.table] || [];
    rows = this._applyConditions(rows);
    rows = this._applyOrdering(rows);
    rows = this._applyLimit(rows);
    return rows;
  }

  get() {
    const rows = this.all();
    return rows.length > 0 ? rows[0] : undefined;
  }
}

function prepare(query) {
  return {
    run(...params) {
      let paramIndex = 0;
      
      const getNextParam = () => params[paramIndex++];

      if (query.toUpperCase().startsWith('INSERT INTO')) {
        const match = query.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (match) {
          const [, table, fieldsPart, valuesPart] = match;
          const fields = fieldsPart.split(',').map(s => s.trim());
          const valuePlaceholders = valuesPart.split(',').map(s => s.trim());
          
          const row = {};
          fields.forEach((field, idx) => {
            const placeholder = valuePlaceholders[idx];
            if (placeholder === '?') {
              row[field] = getNextParam();
            } else if (placeholder.toUpperCase().includes("DATETIME('NOW')")) {
              row[field] = new Date().toISOString().replace('T', ' ').substring(0, 19);
            } else {
              row[field] = placeholder.replace(/'/g, '');
            }
          });
          
          if (!store[table]) store[table] = [];
          store[table].push(row);
          saveData();
          return { changes: 1 };
        }
      }
      
      if (query.toUpperCase().startsWith('UPDATE')) {
        const match = query.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
        if (match) {
          const [, table, setPart, wherePart] = match;
          
          const setClauses = [];
          let remaining = setPart;
          while (remaining.length > 0) {
            const eqIdx = remaining.indexOf('=');
            if (eqIdx === -1) break;
            const field = remaining.substring(0, eqIdx).trim();
            remaining = remaining.substring(eqIdx + 1).trim();
            
            if (remaining.startsWith('?')) {
              setClauses.push({ field, value: getNextParam() });
              remaining = remaining.substring(1).trim();
            } else if (remaining.toUpperCase().startsWith("DATETIME('NOW')")) {
              setClauses.push({ field, value: new Date().toISOString().replace('T', ' ').substring(0, 19) });
              remaining = remaining.substring("DATETIME('NOW')".length).trim();
            } else {
              const commaIdx = remaining.indexOf(',');
              const value = commaIdx !== -1 ? remaining.substring(0, commaIdx).trim() : remaining.trim();
              setClauses.push({ field, value: value.replace(/'/g, '') });
              remaining = commaIdx !== -1 ? remaining.substring(commaIdx + 1).trim() : '';
            }
          }
          
          const whereClauses = [];
          let whereRemaining = wherePart;
          while (whereRemaining.length > 0) {
            const andIdx = whereRemaining.toUpperCase().indexOf(' AND ');
            const clause = andIdx !== -1 ? whereRemaining.substring(0, andIdx).trim() : whereRemaining.trim();
            
            const eqIdx = clause.indexOf('=');
            if (eqIdx !== -1) {
              const field = clause.substring(0, eqIdx).trim();
              const valuePart = clause.substring(eqIdx + 1).trim();
              if (valuePart === '?') {
                whereClauses.push({ field, value: getNextParam() });
              } else {
                whereClauses.push({ field, value: valuePart.replace(/'/g, '') });
              }
            }
            
            whereRemaining = andIdx !== -1 ? whereRemaining.substring(andIdx + 5).trim() : '';
          }
          
          let updated = 0;
          const rows = store[table] || [];
          for (const row of rows) {
            let match = true;
            for (const wc of whereClauses) {
              if (row[wc.field] !== wc.value) {
                match = false;
                break;
              }
            }
            if (match) {
              for (const sc of setClauses) {
                row[sc.field] = sc.value;
              }
              updated++;
            }
          }
          
          saveData();
          return { changes: updated };
        }
      }
      
      if (query.toUpperCase().startsWith('DELETE FROM')) {
        const match = query.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(.+)$/i);
        if (match) {
          const [, table, wherePart] = match;
          
          const whereClauses = [];
          let whereRemaining = wherePart;
          while (whereRemaining.length > 0) {
            const andIdx = whereRemaining.toUpperCase().indexOf(' AND ');
            const clause = andIdx !== -1 ? whereRemaining.substring(0, andIdx).trim() : whereRemaining.trim();
            
            const eqIdx = clause.indexOf('=');
            if (eqIdx !== -1) {
              const field = clause.substring(0, eqIdx).trim();
              const valuePart = clause.substring(eqIdx + 1).trim();
              if (valuePart === '?') {
                whereClauses.push({ field, value: getNextParam() });
              } else {
                whereClauses.push({ field, value: valuePart.replace(/'/g, '') });
              }
            }
            
            whereRemaining = andIdx !== -1 ? whereRemaining.substring(andIdx + 5).trim() : '';
          }
          
          const rows = store[table] || [];
          const newRows = rows.filter(row => {
            for (const wc of whereClauses) {
              if (row[wc.field] === wc.value) return false;
            }
            return true;
          });
          
          const deleted = rows.length - newRows.length;
          store[table] = newRows;
          saveData();
          return { changes: deleted };
        }
      }
      
      return { changes: 0 };
    },
    
    all(...params) {
      const lines = query.trim().split('\n');
      const cleanQuery = lines.map(l => l.trim()).filter(l => l.length > 0).join(' ');
      
      const selectMatch = cleanQuery.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
      if (!selectMatch) return [];
      
      const [, fieldsPart, table] = selectMatch;
      let rows = store[table] || [];
      
      const whereMatch = cleanQuery.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
      if (whereMatch) {
        let paramIndex = 0;
        const whereStr = whereMatch[1];
        const conditions = whereStr.split(/\s+AND\s+/i);
        
        rows = rows.filter(row => {
          for (const cond of conditions) {
            const trimmed = cond.trim();
            
            if (trimmed.includes('IS NULL')) {
              const field = trimmed.replace(/\s+IS\s+NULL/i, '').trim();
              if (row[field] !== null && row[field] !== undefined) return false;
              continue;
            }
            
            if (trimmed.includes('IS NOT NULL')) {
              const field = trimmed.replace(/\s+IS\s+NOT\s+NULL/i, '').trim();
              if (row[field] === null || row[field] === undefined) return false;
              continue;
            }
            
            const eqMatch = trimmed.match(/(\w+)\s*(<=|>=|<|>|=)\s*(.+)/);
            if (!eqMatch) continue;
            
            const [, field, op, valuePart] = eqMatch;
            let value;
            
            if (valuePart === '?') {
              value = params[paramIndex++];
            } else if (valuePart.startsWith("'") && valuePart.endsWith("'")) {
              value = valuePart.slice(1, -1);
            } else if (!isNaN(valuePart)) {
              value = parseFloat(valuePart);
            } else {
              value = valuePart;
            }
            
            const rowValue = row[field];
            let match = false;
            
            switch (op) {
              case '=': match = rowValue === value; break;
              case '<=': match = rowValue <= value; break;
              case '>=': match = rowValue >= value; break;
              case '<': match = rowValue < value; break;
              case '>': match = rowValue > value; break;
            }
            
            if (!match) return false;
          }
          return true;
        });
      }
      
      const joinMatch = cleanQuery.match(/JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
      if (joinMatch) {
        const [, joinTable, t1, f1, t2, f2] = joinMatch;
        const joinRows = store[joinTable] || [];
        
        const result = [];
        for (const row of rows) {
          for (const joinRow of joinRows) {
            const val1 = f1 === 'id' && table !== t1 ? row[`${joinTable}_id`] : row[f1];
            const val2 = f2 === 'id' && table !== t2 ? joinRow[`${table}_id`] : joinRow[f2];
            
            if (val1 && val2 && row[t1 + '_' + f1] === joinRow[f2]) {
              result.push({ ...row, ...Object.fromEntries(
                Object.entries(joinRow).map(([k, v]) => [joinTable.endsWith('s') ? joinTable.slice(0, -1) + '_' + k : joinTable + '_' + k, v])
              )});
            } else if (val1 === val2) {
              result.push({ ...row, ...joinRow });
            }
          }
        }
        rows = result;
      }
      
      const orderByMatch = cleanQuery.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderByMatch) {
        const [, field, direction] = orderByMatch;
        rows = [...rows].sort((a, b) => {
          if (a[field] < b[field]) return direction?.toUpperCase() === 'DESC' ? 1 : -1;
          if (a[field] > b[field]) return direction?.toUpperCase() === 'DESC' ? -1 : 1;
          return 0;
        });
      }
      
      const limitMatch = cleanQuery.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        rows = rows.slice(0, parseInt(limitMatch[1]));
      }
      
      return rows;
    },
    
    get(...params) {
      const rows = this.all(...params);
      return rows.length > 0 ? rows[0] : undefined;
    }
  };
}

function from(table) {
  return new QueryBuilder(table);
}

function exec(sql) {
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    if (statement.toUpperCase().startsWith('CREATE TABLE')) {
      const match = statement.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
      if (match && !store[match[1]]) {
        store[match[1]] = [];
      }
    } else if (statement.toUpperCase().startsWith('CREATE INDEX')) {
    }
  }
  
  saveData();
}

function transaction(fn) {
  const backup = JSON.stringify(store);
  try {
    const result = fn();
    saveData();
    return result;
  } catch (error) {
    store = JSON.parse(backup);
    saveData();
    throw error;
  }
}

function initDatabase() {
  loadData();
  
  const tables = [
    'customers',
    'temperature_zones',
    'zone_rates',
    'age_ladders',
    'operation_ladders',
    'inventory_snapshots',
    'operations',
    'bills',
    'bill_status_history',
    'bill_line_items',
    'bill_age_details',
    'adjustments',
    'idempotent_records'
  ];
  
  for (const table of tables) {
    if (!store[table]) {
      store[table] = [];
    }
  }
  
  saveData();
}

function getStore() {
  return store;
}

module.exports = { 
  db: { prepare, exec, from, transaction },
  initDatabase,
  getStore,
  store
};
