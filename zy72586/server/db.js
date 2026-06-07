const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function loadDB() {
  if (!fs.existsSync(dbPath)) {
    return initEmptyDB();
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return initEmptyDB();
  }
}

function saveDB(db) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function initEmptyDB() {
  return {
    weekly_reports: [],
    negative_samples: [],
    sample_audit_logs: [],
    recall_candidates: [],
    self_check_results: [],
    export_records: [],
    _counters: {
      weekly_reports: 0,
      negative_samples: 0,
      sample_audit_logs: 0,
      recall_candidates: 0,
      self_check_results: 0,
      export_records: 0
    }
  };
}

function nextId(table) {
  const db = loadDB();
  db._counters[table] = (db._counters[table] || 0) + 1;
  saveDB(db);
  return db._counters[table];
}

function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function createStatement(sql) {
  const trimmed = sql.trim().toUpperCase();
  
  if (trimmed.startsWith('INSERT INTO')) {
    const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    const colsMatch = sql.match(/\(([^)]+)\)/);
    const columns = colsMatch ? colsMatch[1].split(',').map(s => s.trim()) : [];
    
    return {
      run(...args) {
        const db = loadDB();
        const row = {};
        const id = nextId(table);
        row.id = id;
        columns.forEach((col, i) => {
          if (col !== 'id') {
            row[col] = args[i];
          }
        });
        if (!row.created_at) row.created_at = now();
        if (!row.updated_at && db[table] && db[table][0] && 'updated_at' in db[table][0]) {
          row.updated_at = now();
        }
        if (!db[table]) db[table] = [];
        db[table].push(row);
        saveDB(db);
        return { lastInsertRowid: id, changes: 1 };
      }
    };
  }
  
  if (trimmed.startsWith('SELECT')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const whereMatch = sql.match(/WHERE\s+([^;]+)/i);
    
    function extractWhereClause(whereStr) {
      const conditions = [];
      const parts = whereStr.split(/\s+AND\s+/i);
      parts.forEach(p => {
        const eq = p.match(/(\w+)\s*=\s*\?/i);
        if (eq) {
          conditions.push({ field: eq[1], op: '=' });
        }
      });
      return conditions;
    }
    
    return {
      get(...args) {
        const db = loadDB();
        let rows = db[table] || [];
        if (whereMatch) {
          const conditions = extractWhereClause(whereMatch[1]);
          rows = rows.filter(row => {
            return conditions.every((c, i) => row[c.field] == args[i]);
          });
        }
        return rows[0] || undefined;
      },
      all(...args) {
        const db = loadDB();
        let rows = [...(db[table] || [])];
        if (whereMatch) {
          const conditions = extractWhereClause(whereMatch[1]);
          rows = rows.filter(row => {
            return conditions.every((c, i) => row[c.field] == args[i]);
          });
        }
        return rows;
      }
    };
  }
  
  if (trimmed.startsWith('UPDATE')) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = sql.match(/WHERE\s+(.+)/i);
    
    return {
      run(...args) {
        const db = loadDB();
        const setStr = setMatch ? setMatch[1] : '';
        const setParts = setStr.split(',').map(s => s.trim());
        const assignments = [];
        let argIdx = 0;
        
        setParts.forEach(part => {
          const m = part.match(/(\w+)\s*=\s*\?/i);
          if (m) {
            assignments.push({ field: m[1], value: args[argIdx++] });
          } else {
            const currM = part.match(/(\w+)\s*=\s*CURRENT_TIMESTAMP/i);
            if (currM) {
              assignments.push({ field: currM[1], value: now() });
            }
          }
        });
        
        let changes = 0;
        if (whereMatch) {
          const whereStr = whereMatch[1];
          const eq = whereStr.match(/(\w+)\s*=\s*\?/i);
          if (eq) {
            const whereField = eq[1];
            const whereValue = args[argIdx];
            db[table].forEach(row => {
              if (row[whereField] == whereValue) {
                assignments.forEach(a => {
                  row[a.field] = a.value;
                });
                changes++;
              }
            });
          }
        }
        
        saveDB(db);
        return { changes };
      }
    };
  }
  
  if (trimmed.startsWith('DELETE')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    return {
      run(...args) {
        const db = loadDB();
        const whereMatch = sql.match(/WHERE\s+(.+)/i);
        let changes = 0;
        if (whereMatch) {
          const eq = whereMatch[1].match(/(\w+)\s*=\s*\?/i);
          if (eq) {
            const before = db[table].length;
            db[table] = db[table].filter(row => row[eq[1]] != args[0]);
            changes = before - db[table].length;
          }
        }
        saveDB(db);
        return { changes };
      }
    };
  }
  
  return {
    run() { return { changes: 0 }; },
    get() { return undefined; },
    all() { return []; }
  };
}

const db = {
  prepare(sql) {
    return createStatement(sql);
  },
  exec(sql) {
    const statements = sql.split(';').filter(s => s.trim());
    statements.forEach(stmt => {
      if (stmt.trim()) {
        try { createStatement(stmt).run(); } catch(e) {}
      }
    });
  },
  pragma() {}
};

module.exports = db;
