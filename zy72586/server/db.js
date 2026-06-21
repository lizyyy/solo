const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function loadDB() {
  if (!fs.existsSync(dbPath)) return initEmptyDB();
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    if (!raw.trim()) return initEmptyDB();
    const data = JSON.parse(raw);
    if (!data._counters) data._counters = {};
    return data;
  } catch (e) {
    return initEmptyDB();
  }
}

function saveDB(db) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function insertRow(table, fields, values) {
  const db = loadDB();
  if (!db[table]) db[table] = [];
  if (!db._counters) db._counters = {};
  if (db._counters[table] == null) db._counters[table] = 0;
  db._counters[table] += 1;

  const row = { id: db._counters[table] };
  fields.forEach((f, i) => {
    if (f !== 'id') row[f] = values[i];
  });
  if (!row.created_at) row.created_at = now();
  if (table !== 'sample_audit_logs' && table !== 'self_check_results' && table !== 'export_records') {
    if (!row.updated_at) row.updated_at = now();
  }
  db[table].push(row);
  saveDB(db);
  return { lastInsertRowid: row.id, changes: 1, row };
}

function updateRow(table, setFields, setValues, whereField, whereValue) {
  const db = loadDB();
  if (!db[table]) return { changes: 0 };
  let changes = 0;
  db[table].forEach(row => {
    if (String(row[whereField]) === String(whereValue)) {
      setFields.forEach((f, i) => { row[f] = setValues[i]; });
      if ('updated_at' in row && !setFields.includes('updated_at')) {
        row.updated_at = now();
      }
      changes++;
    }
  });
  saveDB(db);
  return { changes };
}

function selectRows(table, whereField, whereValue, single = false) {
  const db = loadDB();
  let rows = db[table] || [];
  if (whereField != null) {
    rows = rows.filter(r => String(r[whereField]) === String(whereValue));
  }
  return single ? rows[0] : rows;
}

function deleteRows(table, whereField, whereValue) {
  const db = loadDB();
  if (!db[table]) return { changes: 0 };
  const before = db[table].length;
  if (whereField != null) {
    db[table] = db[table].filter(r => String(r[whereField]) !== String(whereValue));
  } else {
    db[table] = [];
  }
  saveDB(db);
  return { changes: before - db[table].length };
}

const db = {
  prepare(sql) {
    const trimmed = sql.trim();
    if (trimmed.toUpperCase().startsWith('INSERT INTO')) {
      const m = trimmed.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i);
      if (!m) return { run: () => ({ changes: 0, lastInsertRowid: 0 }) };
      const table = m[1];
      const fields = m[2].split(',').map(s => s.trim());
      return {
        run(...args) { return insertRow(table, fields, args); }
      };
    }
    if (trimmed.toUpperCase().startsWith('SELECT')) {
      const fm = trimmed.match(/FROM\s+(\w+)/i);
      const wm = trimmed.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      const table = fm ? fm[1] : null;
      const whereField = wm ? wm[1] : null;
      return {
        get(...args) { return selectRows(table, whereField, args[0], true); },
        all(...args) { return selectRows(table, whereField, args[0], false); }
      };
    }
    if (trimmed.toUpperCase().startsWith('UPDATE')) {
      const tm = trimmed.match(/UPDATE\s+(\w+)/i);
      const sm = trimmed.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
      const wm = trimmed.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      const table = tm ? tm[1] : null;
      const whereField = wm ? wm[1] : null;
      return {
        run(...args) {
          const setStr = sm ? sm[1] : '';
          const setFields = [];
          const setValues = [];
          let argIdx = 0;
          setStr.split(',').map(s => s.trim()).forEach(part => {
            const m1 = part.match(/(\w+)\s*=\s*\?/i);
            if (m1) { setFields.push(m1[1]); setValues.push(args[argIdx++]); }
            else {
              const m2 = part.match(/(\w+)\s*=\s*CURRENT_TIMESTAMP/i);
              if (m2) { setFields.push(m2[1]); setValues.push(now()); }
            }
          });
          return updateRow(table, setFields, setValues, whereField, args[argIdx]);
        }
      };
    }
    if (trimmed.toUpperCase().startsWith('DELETE')) {
      const fm = trimmed.match(/FROM\s+(\w+)/i);
      const wm = trimmed.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      const table = fm ? fm[1] : null;
      const whereField = wm ? wm[1] : null;
      return {
        run(...args) { return deleteRows(table, whereField, args[0]); }
      };
    }
    return {
      run() { return { changes: 0, lastInsertRowid: 0 }; },
      get() { return undefined; },
      all() { return []; }
    };
  },
  exec(sql) {
    sql.split(';').filter(s => s.trim()).forEach(stmt => {
      try { db.prepare(stmt).run(); } catch(e) {}
    });
  },
  pragma() {}
};

module.exports = {
  ...db,
  loadDB,
  saveDB,
  insertRow,
  updateRow,
  selectRows,
  deleteRows,
  now
};
