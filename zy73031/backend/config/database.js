const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'pet_hospital.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbInstance = null;
let SQL = null;

async function getDatabase() {
  if (dbInstance) return dbInstance;
  if (!SQL) SQL = await initSqlJs();

  let buf = null;
  if (fs.existsSync(DB_PATH)) {
    buf = fs.readFileSync(DB_PATH);
  }
  const db = new SQL.Database(buf);

  let saveTimer = null;
  db._scheduleSave = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      } catch(e) { console.error('save db error:', e.message); }
    }, 30);
  };
  db._saveImmediate = () => {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  };

  const origPrepare = db.prepare.bind(db);

  function buildParams(stmt, args) {
    if (!args.length) return;
    let params;
    if (args.length === 1 && Array.isArray(args[0])) params = args[0];
    else if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) params = args[0];
    else params = args;
    if (params) stmt.bind(params);
  }

  db.prepare = function(sql) {
    const stmt = origPrepare(sql);
    let freed = false;
    const safeFree = () => { if (!freed) { try { stmt.free(); } catch(e){} freed = true; } };

    return {
      run(...args) {
        if (freed) throw new Error('statement already freed');
        try {
          stmt.reset();
          buildParams(stmt, args);
          while (stmt.step()) {}
          const lastId = db._execRaw('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0];
          const changes = db.getRowsModified() || 0;
          db._scheduleSave();
          return { changes, lastInsertRowid: lastId };
        } catch(e) {
          throw e;
        }
      },
      get(...args) {
        if (freed) throw new Error('statement already freed');
        try {
          stmt.reset();
          buildParams(stmt, args);
          let row = null;
          if (stmt.step()) {
            try { row = stmt.getAsObject(); } catch(e) { row = null; }
          }
          return row;
        } catch(e) {
          throw e;
        }
      },
      all(...args) {
        if (freed) throw new Error('statement already freed');
        try {
          stmt.reset();
          buildParams(stmt, args);
          const rows = [];
          while (stmt.step()) {
            try { rows.push(stmt.getAsObject()); } catch(e) {}
          }
          return rows;
        } catch(e) {
          throw e;
        }
      },
      free() { safeFree(); }
    };
  };

  const origExec = db.exec.bind(db);
  db.exec = function(sql) {
    const r = origExec(sql);
    db._scheduleSave();
    return r;
  };
  db._execRaw = origExec;

  db.transaction = function(fn) {
    return (...args) => {
      origExec('BEGIN');
      try {
        const res = fn(...args);
        origExec('COMMIT');
        db._scheduleSave();
        return res;
      } catch(e) {
        try { origExec('ROLLBACK'); } catch(_){}
        db._scheduleSave();
        throw e;
      }
    };
  };

  process.on('exit', () => { try { db._saveImmediate(); } catch(e){} });

  dbInstance = db;
  return db;
}

module.exports = { getDatabase, DB_PATH };
module.exports.default = getDatabase;
