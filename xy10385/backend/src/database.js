const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'hospital-escort.json');

let db = {
  patients: [],
  escorts: [],
  examinations: [],
  orders: [],
  order_timeline: [],
  schedules: [],
  order_examinations: [],
  order_fees: [],
  idempotent_records: []
};

function loadDatabase() {
  if (fs.existsSync(dbFile)) {
    try {
      const content = fs.readFileSync(dbFile, 'utf-8');
      db = JSON.parse(content);
    } catch (e) {
      console.log('Database file corrupted, starting fresh');
      saveDatabase();
    }
  }
}

function saveDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

loadDatabase();

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sortField = null;
    this.sortDir = 'asc';
    this.limitVal = null;
  }

  where(field, operator, value) {
    this.filters.push({ field, operator, value });
    return this;
  }

  orderBy(field, dir = 'asc') {
    this.sortField = field;
    this.sortDir = dir;
    return this;
  }

  limit(n) {
    this.limitVal = n;
    return this;
  }

  applyFilters(rows) {
    return rows.filter(row => {
      return this.filters.every(f => {
        switch (f.operator) {
          case '=':
            return row[f.field] === f.value;
          case '!=':
            return row[f.field] !== f.value;
          case '>':
            return row[f.field] > f.value;
          case '>=':
            return row[f.field] >= f.value;
          case '<':
            return row[f.field] < f.value;
          case '<=':
            return row[f.field] <= f.value;
          case 'IN':
            return (f.value || []).includes(row[f.field]);
          case 'LIKE':
            return String(row[f.field] || '').toLowerCase()
              .includes(String(f.value || '').toLowerCase());
          default:
            return true;
        }
      });
    });
  }

  applySort(rows) {
    if (!this.sortField) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];
      let cmp = 0;
      if (aVal < bVal) cmp = -1;
      else if (aVal > bVal) cmp = 1;
      return this.sortDir === 'desc' ? -cmp : cmp;
    });
  }

  applyLimit(rows) {
    if (this.limitVal === null) return rows;
    return rows.slice(0, this.limitVal);
  }

  all() {
    let result = db[this.table] || [];
    result = this.applyFilters(result);
    result = this.applySort(result);
    result = this.applyLimit(result);
    return result;
  }

  first() {
    const result = this.all();
    return result[0] || null;
  }

  get() {
    return this.all();
  }
}

function from(table) {
  return new QueryBuilder(table);
}

function exec(sql) {
  const statements = sql.split(';').map(s => s.trim()).filter(s => s);
  statements.forEach(stmt => {
    if (stmt.startsWith('CREATE TABLE')) return;
    if (stmt.startsWith('CREATE INDEX')) return;
    if (stmt.startsWith('PRAGMA')) return;
  });
}

function pragma(value) {
  return;
}

function prepare(sql) {
  const trimmed = sql.trim();
  
  if (trimmed.startsWith('SELECT')) {
    const tableMatch = trimmed.match(/FROM\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    
    if (!table) {
      return { all: () => [], get: () => null };
    }
    
    return {
      all: (...params) => {
        let result = db[table] || [];
        return result;
      },
      get: (...params) => {
        const result = db[table] || [];
        return result[0] || null;
      }
    };
  }

  if (trimmed.startsWith('INSERT')) {
    const tableMatch = trimmed.match(/INTO\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    
    const fieldsMatch = trimmed.match(/\(([^)]+)\)/);
    const fields = fieldsMatch 
      ? fieldsMatch[1].split(',').map(f => f.trim().replace(/DEFAULT\s+\w+/i, '').trim())
      : [];

    return {
      run: (...params) => {
        if (!table) return { lastInsertRowid: null };
        if (!db[table]) db[table] = [];
        
        const record = {};
        const filteredFields = fields.filter(f => !f.includes('DEFAULT'));
        
        filteredFields.forEach((field, idx) => {
          let val = params[idx];
          
          if (val === undefined || val === null) {
            if (field.includes('DEFAULT CURRENT_TIMESTAMP')) {
              val = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }
          }
          record[field] = val;
        });

        db[table].push(record);
        saveDatabase();
        return { lastInsertRowid: null, changes: 1 };
      }
    };
  }

  if (trimmed.startsWith('UPDATE')) {
    const tableMatch = trimmed.match(/UPDATE\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    
    const setMatch = trimmed.match(/SET\s+(.+?)(?:WHERE|$)/i);
    const whereMatch = trimmed.match(/WHERE\s+(.+)/i);

    return {
      run: (...params) => {
        if (!table || !db[table]) return { changes: 0 };
        
        let paramIdx = 0;
        let changes = 0;
        
        db[table].forEach(record => {
          let match = true;
          if (whereMatch) {
            const cond = whereMatch[1].trim();
            if (cond.includes('?')) {
              const parts = cond.split(/\s*=\s*\?\s*/);
              if (parts.length >= 2) {
                const field = parts[0].trim();
                const val = params[paramIdx++];
                match = record[field] === val;
              }
            }
          }
          
          if (match) {
            if (setMatch) {
              const setParts = setMatch[1].split(',').map(p => p.trim());
              setParts.forEach(part => {
                const [field, ...rest] = part.split('=');
                let val = rest.join('=');
                if (val.includes('?')) {
                  val = params[paramIdx++];
                }
                if (val.includes('CURRENT_TIMESTAMP')) {
                  val = new Date().toISOString().replace('T', ' ').substring(0, 19);
                }
                record[field.trim()] = val;
              });
            }
            changes++;
          }
        });
        
        saveDatabase();
        return { changes };
      }
    };
  }

  if (trimmed.startsWith('DELETE')) {
    const tableMatch = trimmed.match(/FROM\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    const whereMatch = trimmed.match(/WHERE\s+(.+)/i);

    return {
      run: (...params) => {
        if (!table || !db[table]) return { changes: 0 };
        
        let paramIdx = 0;
        
        if (whereMatch) {
          const cond = whereMatch[1].trim();
          if (cond.includes('?')) {
            const parts = cond.split(/\s*=\s*\?\s*/);
            if (parts.length >= 2) {
              const field = parts[0].trim();
              const val = params[paramIdx++];
              db[table] = db[table].filter(r => r[field] !== val);
            }
          }
        } else {
          db[table] = [];
        }
        
        saveDatabase();
        return { changes: 1 };
      }
    };
  }

  return {
    all: () => [],
    get: () => null,
    run: () => ({ changes: 0 })
  };
}

function transaction(fn) {
  try {
    fn();
    saveDatabase();
    return true;
  } catch (e) {
    throw e;
  }
}

function initDatabase() {
  exec(`
    CREATE TABLE IF NOT EXISTS patients;
    CREATE TABLE IF NOT EXISTS escorts;
    CREATE TABLE IF NOT EXISTS examinations;
    CREATE TABLE IF NOT EXISTS orders;
    CREATE TABLE IF NOT EXISTS order_timeline;
    CREATE TABLE IF NOT EXISTS schedules;
    CREATE TABLE IF NOT EXISTS order_examinations;
    CREATE TABLE IF NOT EXISTS order_fees;
    CREATE TABLE IF NOT EXISTS idempotent_records;
  `);
}

module.exports = { 
  db: { prepare, exec, pragma, transaction, from, save: saveDatabase, _data: db },
  initDatabase,
  from
};
