const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'data.json');

let db = {
  orders: [],
  order_items: [],
  documents: [],
  tax_codes: [],
  checkpoints: [],
  supplements: [],
  status_history: [],
  manual_corrections: []
};

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (fs.existsSync(dataFile)) {
    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      db = { ...db, ...parsed };
    } catch (e) {
      console.warn('数据文件损坏，使用空数据', e.message);
    }
  }
}

function saveData() {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf-8');
}

function prepare(sql) {
  const isSelect = /^\s*SELECT/i.test(sql);
  const isInsert = /^\s*INSERT/i.test(sql);
  const isUpdate = /^\s*UPDATE/i.test(sql);
  const isDelete = /^\s*DELETE/i.test(sql);
  const isExec = /^\s*(CREATE|DROP|PRAGMA|DELETE)/i.test(sql);

  return {
    run(...params) {
      if (isInsert) {
        const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (match) {
          const tableName = match[1];
          const columns = match[2].split(',').map(s => s.trim());
          const values = params;
          const row = {};
          columns.forEach((col, i) => {
            row[col] = values[i];
          });
          if (!db[tableName]) db[tableName] = [];
          db[tableName].push(row);
          saveData();
          return { lastInsertRowid: db[tableName].length - 1, changes: 1 };
        }
      }
      
      if (isUpdate) {
        const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
        if (match) {
          const tableName = match[1];
          const setPart = match[2];
          const wherePart = match[3];
          
          const setPairs = [];
          let paramIdx = 0;
          let i = 0;
          while (i < setPart.length) {
            if (setPart[i] === '?') {
              const before = setPart.slice(0, i).split(',').pop().split('=')[0].trim();
              setPairs.push({ key: before, value: params[paramIdx++] });
              i++;
            } else {
              i++;
            }
          }
          
          setPairs.forEach(({ key, value }) => {
            db[tableName] = db[tableName] || [];
            db[tableName].forEach(row => {
              let matches = true;
              if (wherePart) {
                const conds = wherePart.split(/\s+AND\s+/i);
                conds.forEach(cond => {
                  const [k, op, v] = cond.trim().split(/\s+/);
                  if (v === '?') {
                    if (row[k] !== params[paramIdx++]) matches = false;
                  } else {
                    const literal = v.replace(/^['"]|['"]$/g, '');
                    if (op === '=' && row[k] !== literal) matches = false;
                    if (op === '!=' && row[k] === literal) matches = false;
                  }
                });
              }
              if (matches) {
                row[key] = value;
              }
            });
          });
          
          saveData();
          return { changes: 1 };
        }
      }
      
      if (isDelete) {
        const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
        if (match) {
          const tableName = match[1];
          const wherePart = match[2];
          
          db[tableName] = db[tableName] || [];
          const originalLength = db[tableName].length;
          
          if (wherePart) {
            db[tableName] = db[tableName].filter(row => {
              const conds = wherePart.split(/\s+AND\s+/i);
              let matches = true;
              let paramIdx = 0;
              conds.forEach(cond => {
                const parts = cond.trim().split(/\s+/);
                const k = parts[0];
                const op = parts[1];
                const v = parts[2];
                if (v === '?') {
                  if (op === '=' && row[k] !== params[paramIdx++]) matches = false;
                  if (op === '!=' && row[k] === params[paramIdx++]) matches = false;
                } else {
                  const literal = v.replace(/^['"]|['"]$/g, '');
                  if (op === '=' && row[k] !== literal) matches = false;
                  if (op === '!=' && row[k] === literal) matches = false;
                }
              });
              return !matches;
            });
          } else {
            db[tableName] = [];
          }
          
          saveData();
          return { changes: originalLength - db[tableName].length };
        }
      }
      
      if (isExec && !isSelect && !isInsert && !isUpdate) {
        saveData();
        return {};
      }
      
      return { changes: 0 };
    },
    
    get(...params) {
      const results = this.all(...params);
      return results[0];
    },
    
    all(...params) {
      if (!isSelect) return [];
      
      let tableName = null;
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (fromMatch) tableName = fromMatch[1];
      
      if (!tableName || !db[tableName]) return [];
      
      let results = [...db[tableName]];
      
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
      if (whereMatch) {
        const wherePart = whereMatch[1];
        let paramIdx = 0;
        results = results.filter(row => {
          const conds = wherePart.split(/\s+AND\s+/i);
          return conds.every(cond => {
            const parts = cond.trim().split(/\s+/);
            const k = parts[0];
            const op = parts[1] || '=';
            const v = parts[2];
            
            let compareValue;
            if (v === '?') {
              compareValue = params[paramIdx++];
            } else if (v !== undefined) {
              compareValue = v.replace(/^['"]|['"]$/g, '');
            }
            
            if (op === '=') return row[k] === compareValue;
            if (op === '!=') return row[k] !== compareValue;
            if (op === '>=') return row[k] >= compareValue;
            if (op === '<=') return row[k] <= compareValue;
            if (op === '>') return row[k] > compareValue;
            if (op === '<') return row[k] < compareValue;
            if (op.toUpperCase() === 'IN') return true;
            if (v === undefined && cond.includes('1=1')) return true;
            return true;
          });
        });
      }
      
      const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderMatch) {
        const orderCol = orderMatch[1];
        const orderDir = (orderMatch[2] || 'ASC').toUpperCase();
        results.sort((a, b) => {
          if (a[orderCol] < b[orderCol]) return orderDir === 'ASC' ? -1 : 1;
          if (a[orderCol] > b[orderCol]) return orderDir === 'ASC' ? 1 : -1;
          return 0;
        });
      }
      
      const limitMatch = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        const offset = parseInt(limitMatch[2] || '0');
        results = results.slice(offset, offset + limit);
      }
      
      return results;
    }
  };
}

function pragma(_) {
  return [];
}

function exec(_) {
  saveData();
  return [];
}

function close() {}

loadData();

module.exports = () => ({
  prepare,
  pragma,
  exec,
  close
});
