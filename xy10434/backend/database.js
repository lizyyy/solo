const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
let db = null;
let SQL = null;

async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  if (db) {
    return db;
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function prepare(sql) {
  return {
    run: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      saveDatabase();
      
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
      }
      return { changes: db.getRowsModified() };
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

function pragma(sql) {
  return db.exec(`PRAGMA ${sql}`);
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  pragma,
  saveDatabase
};
