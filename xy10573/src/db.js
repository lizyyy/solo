const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'petboarding.json');

const DEFAULT_TABLES = {
  rooms: [],
  room_inventory: [],
  pets: [],
  vaccine_records: [],
  boarding_bookings: [],
  feeding_plans: [],
  transport_records: [],
  add_ons: [],
  booking_add_ons: [],
  feeding_records: [],
  care_logs: [],
  booking_histories: [],
  settlements: [],
  idempotency_records: []
};

function now() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function createDb() {
  let data = JSON.parse(JSON.stringify(DEFAULT_TABLES));
  
  function loadDb() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(dbFile)) {
      try {
        const content = fs.readFileSync(dbFile, 'utf-8');
        const loaded = JSON.parse(content);
        for (const table of Object.keys(DEFAULT_TABLES)) {
          if (!loaded[table]) loaded[table] = [];
        }
        data = loaded;
      } catch (e) {
        data = JSON.parse(JSON.stringify(DEFAULT_TABLES));
      }
    }
  }
  
  function saveDb() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
  }
  
  function matchWhere(row, whereSql, params) {
    const parts = whereSql.split(/\s+AND\s+/i);
    let paramIdx = 0;
    
    for (const part of parts) {
      if (!matchSingleCondition(row, part, params, () => paramIdx++)) {
        return false;
      }
    }
    return true;
  }
  
  function matchSingleCondition(row, condition, params, nextParam) {
    const orParts = condition.split(/\s+OR\s+/i);
    for (const part of orParts) {
      if (checkOp(row, part, params, nextParam)) {
        return true;
      }
    }
    return false;
  }
  
  function checkOp(row, condition, params, nextParam) {
    const isNot = condition.toUpperCase().includes('NOT IN');
    
    if (condition.toUpperCase().includes('!=')) {
      const [field, val] = condition.split('!=').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : val.replace(/^['"]|['"]$/g, '');
      return row[field] != value;
    }
    
    if (condition.toUpperCase().includes('<>')) {
      const [field, val] = condition.split('<>').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : val.replace(/^['"]|['"]$/g, '');
      return row[field] != value;
    }
    
    if (condition.includes('=')) {
      const [field, val] = condition.split('=').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : val.replace(/^['"]|['"]$/g, '');
      if (!isNaN(parseFloat(value)) && value === String(parseFloat(value))) {
        value = parseFloat(value);
      }
      return row[field] == value;
    }
    
    if (condition.includes('>=')) {
      const [field, val] = condition.split('>=').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : parseFloat(val);
      return parseFloat(row[field]) >= value;
    }
    
    if (condition.includes('<=')) {
      const [field, val] = condition.split('<=').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : parseFloat(val);
      return parseFloat(row[field]) <= value;
    }
    
    if (condition.includes('>')) {
      const [field, val] = condition.split('>').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : parseFloat(val);
      return parseFloat(row[field]) > value;
    }
    
    if (condition.includes('<')) {
      const [field, val] = condition.split('<').map(s => s.trim());
      let value = val === '?' ? params[nextParam()] : parseFloat(val);
      return parseFloat(row[field]) < value;
    }
    
    if (condition.toUpperCase().includes('IN (')) {
      const match = condition.match(/(\w+)\s+(?:NOT\s+)?IN\s*\(([^)]+)\)/i);
      if (match) {
        const field = match[1];
        const values = match[2].split(',').map(v => {
          v = v.trim();
          if (v === '?') return params[nextParam()];
          return v.replace(/^['"]|['"]$/g, '');
        });
        const inResult = values.includes(row[field]);
        return isNot ? !inResult : inResult;
      }
    }
    
    if (condition.toUpperCase().includes('IS NULL')) {
      const field = condition.split(/\s+/)[0];
      return row[field] === null || row[field] === undefined;
    }
    
    if (condition.toUpperCase().includes('IS NOT NULL')) {
      const field = condition.split(/\s+/)[0];
      return row[field] !== null && row[field] !== undefined;
    }
    
    return true;
  }
  
  function prepare(sql) {
    return {
      run: function(...params) {
        const upperSql = sql.trim().toUpperCase();
        
        if (upperSql.startsWith('INSERT INTO')) {
          const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          if (!table || !data[table]) return;
          
          const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
          const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
          
          let columns = [];
          if (colsMatch) {
            columns = colsMatch[1].split(',').map(c => c.trim().replace(/`/g, '').replace(/'/g, '').replace(/"/g, ''));
          }
          
          const newRow = {};
          if (valuesMatch) {
            const placeholders = valuesMatch[1].split(',').map(v => v.trim());
            let paramIdx = 0;
            
            for (let i = 0; i < placeholders.length; i++) {
              const ph = placeholders[i];
              let value;
              if (ph === '?') {
                value = params[paramIdx++];
              } else if (ph.toUpperCase() === "DATETIME('NOW')") {
                value = now();
              } else {
                value = ph.replace(/^['"]|['"]$/g, '');
                if (!isNaN(parseFloat(value)) && value === String(parseFloat(value))) {
                  value = parseFloat(value);
                }
              }
              
              if (columns[i]) {
                newRow[columns[i]] = value;
              }
            }
          }
          
          data[table].push(newRow);
          saveDb();
        }
        else if (upperSql.startsWith('UPDATE')) {
          const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          if (!table || !data[table]) return;
          
          const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i);
          const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
          
          if (!setMatch) return;
          
          const setParts = setMatch[1].split(',').map(p => p.trim());
          const updates = {};
          let paramIdx = 0;
          
          for (const part of setParts) {
            const eqMatch = part.match(/^(\w+)\s*=\s*(.+)$/);
            if (eqMatch) {
              const field = eqMatch[1];
              let value = eqMatch[2].trim();
              
              if (value === '?') {
                value = params[paramIdx++];
              } else if (value.toUpperCase() === "DATETIME('NOW')") {
                value = now();
              } else {
                value = value.replace(/^['"]|['"]$/g, '');
                if (!isNaN(parseFloat(value)) && value === String(parseFloat(value))) {
                  value = parseFloat(value);
                }
              }
              
              updates[field] = value;
            }
          }
          
          let updated = 0;
          for (const row of data[table]) {
            let matches = true;
            if (whereMatch) {
              const whereSql = whereMatch[1].trim();
              const whereParams = params.slice(paramIdx);
              matches = matchWhere(row, whereSql, whereParams);
            }
            
            if (matches) {
              updated++;
              for (const [field, value] of Object.entries(updates)) {
                row[field] = value;
              }
            }
          }
          
          if (updated > 0) saveDb();
        }
        else if (upperSql.startsWith('DELETE FROM')) {
          const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
          const table = tableMatch ? tableMatch[1] : null;
          if (!table || !data[table]) return;
          
          const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
          
          if (whereMatch) {
            data[table] = data[table].filter(row => {
              const whereParams = params;
              return !matchWhere(row, whereMatch[1].trim(), whereParams);
            });
          } else {
            data[table] = [];
          }
          
          saveDb();
        }
      },
      
      get: function(...params) {
        const results = this.all(...params);
        return results[0];
      },
      
      all: function(...params) {
        const upperSql = sql.trim().toUpperCase();
        
        if (!upperSql.startsWith('SELECT')) {
          return [];
        }
        
        const fromMatch = sql.match(/FROM\s+(\w+)/i);
        const table = fromMatch ? fromMatch[1] : null;
        if (!table || !data[table]) return [];
        
        let rows = data[table];
        
        const joinMatch = sql.match(/LEFT JOIN\s+(\w+)\s+ON\s+([^ ]+)\s*=\s*([^ ]+)/i);
        let joinedData = null;
        let joinInfo = null;
        
        if (joinMatch) {
          const joinTable = joinMatch[1];
          const leftField = joinMatch[2].split('.').pop();
          const rightField = joinMatch[3].split('.').pop();
          
          if (data[joinTable]) {
            joinedData = data[joinTable];
            joinInfo = { leftField, rightField, joinTable };
          }
        }
        
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|GROUP|$)/i);
        
        if (whereMatch) {
          rows = rows.filter(row => {
            return matchWhere(row, whereMatch[1].trim(), params);
          });
        }
        
        const orderMatch = sql.match(/ORDER BY\s+(\w+(?:\.\w+)?)(?:\s+(DESC|ASC))?/i);
        if (orderMatch) {
          let orderField = orderMatch[1];
          if (orderField.includes('.')) orderField = orderField.split('.')[1];
          
          const direction = (orderMatch[2] || 'ASC').toUpperCase();
          rows.sort((a, b) => {
            const av = a[orderField];
            const bv = b[orderField];
            let cmp = 0;
            if (av === null || av === undefined) cmp = -1;
            else if (bv === null || bv === undefined) cmp = 1;
            else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
            else cmp = String(av).localeCompare(String(bv));
            return direction === 'DESC' ? -cmp : cmp;
          });
        }
        
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
          rows = rows.slice(0, parseInt(limitMatch[1]));
        }
        
        const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
        let fields = ['*'];
        if (selectMatch) {
          const selectPart = selectMatch[1].trim();
          if (selectPart.toUpperCase().startsWith('COUNT')) {
            return [{ cnt: rows.length }];
          }
          if (selectPart.toUpperCase().includes('SUM(')) {
            const sumMatch = selectPart.match(/SUM\(\s*([^)]+)\s*\)/i);
            if (sumMatch) {
              const sumField = sumMatch[1];
              let total = 0;
              for (const row of rows) {
                const val = row[sumField] || 0;
                if (typeof val === 'number') total += val;
              }
              return [{ total }];
            }
          }
          if (selectPart.toUpperCase().includes('COUNT') || selectPart.toUpperCase().includes('SUM')) {
            const groupMatch = sql.match(/GROUP BY\s+(\w+(?:\s*,\s*\w+)*)/i);
            if (groupMatch) {
              const groupFields = groupMatch[1].split(',').map(f => f.trim());
              const groups = {};
              for (const row of rows) {
                const key = groupFields.map(f => row[f]).join('|');
                if (!groups[key]) {
                  groups[key] = { ...row, total_quantity: 0, total_revenue: 0, usage_count: 0 };
                }
                groups[key].usage_count++;
                if (row.quantity) groups[key].total_quantity += row.quantity;
                if (row.total_price) groups[key].total_revenue += row.total_price;
              }
              return Object.values(groups);
            }
          }
          fields = selectPart.split(',').map(f => f.trim());
        }
        
        if (joinInfo) {
          rows = rows.map(row => {
            const joinRow = joinedData.find(jr => jr[joinInfo.rightField] === row[joinInfo.leftField]);
            if (joinRow) {
              return { ...row, ...joinRow };
            }
            return row;
          });
        }
        
        if (fields[0] === '*') return rows;
        
        return rows.map(row => {
          const result = {};
          for (const f of fields) {
            let fieldName = f;
            if (fieldName.includes('.')) fieldName = fieldName.split('.')[1];
            if (row[fieldName] !== undefined) result[fieldName] = row[fieldName];
          }
          return result;
        });
      }
    };
  }
  
  function exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s);
    
    for (const stmt of statements) {
      const upperStmt = stmt.toUpperCase().trim();
      
      if (upperStmt.startsWith('CREATE TABLE')) {
        const match = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
        if (match) {
          const table = match[1];
          if (!data[table]) data[table] = [];
        }
      }
      else if (upperStmt.startsWith('DROP TABLE')) {
        const match = stmt.match(/DROP TABLE\s+(?:IF EXISTS\s+)?(\w+)/i);
        if (match) {
          const table = match[1];
          data[table] = [];
        }
      }
      else if (upperStmt.startsWith('CREATE INDEX')) {
        continue;
      }
      else if (upperStmt.startsWith('PRAGMA')) {
        continue;
      }
      else {
        prepare(stmt).run();
      }
    }
    
    saveDb();
  }
  
  function transaction(fn) {
    const backup = JSON.parse(JSON.stringify(data));
    try {
      fn();
      saveDb();
    } catch (e) {
      data = backup;
      saveDb();
      throw e;
    }
  }
  
  function initDB() {
    loadDb();
    
    if (!data.rooms || data.rooms.length === 0) {
      const tablesSql = `
        CREATE TABLE IF NOT EXISTS rooms;
        CREATE TABLE IF NOT EXISTS room_inventory;
        CREATE TABLE IF NOT EXISTS pets;
        CREATE TABLE IF NOT EXISTS vaccine_records;
        CREATE TABLE IF NOT EXISTS boarding_bookings;
        CREATE TABLE IF NOT EXISTS feeding_plans;
        CREATE TABLE IF NOT EXISTS transport_records;
        CREATE TABLE IF NOT EXISTS add_ons;
        CREATE TABLE IF NOT EXISTS booking_add_ons;
        CREATE TABLE IF NOT EXISTS feeding_records;
        CREATE TABLE IF NOT EXISTS care_logs;
        CREATE TABLE IF NOT EXISTS booking_histories;
        CREATE TABLE IF NOT EXISTS settlements;
        CREATE TABLE IF NOT EXISTS idempotency_records;
      `;
      exec(tablesSql);
    }
  }
  
  function resetDB() {
    data = JSON.parse(JSON.stringify(DEFAULT_TABLES));
    saveDb();
  }
  
  loadDb();
  
  return {
    // 数据
    data,
    // 方法
    prepare,
    exec,
    transaction,
    initDB,
    resetDB,
    loadDb,
    saveDb,
    pragma: () => {}
  };
}

const db = createDb();

module.exports = {
  db,
  prepare: db.prepare,
  exec: db.exec,
  transaction: db.transaction,
  initDB: db.initDB,
  resetDB: db.resetDB,
  now
};