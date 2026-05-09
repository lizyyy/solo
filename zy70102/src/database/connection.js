const initSqlJs = require('sql.js');
const config = require('../config');
const path = require('path');
const fs = require('fs');

const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbWrapper = null;

const saveDatabase = (db) => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.database.path, buffer);
};

class DbWrapper {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    const wrapper = this;
    return {
      run(...params) {
        const stmt = wrapper.db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        saveDatabase(wrapper.db);
        const idResult = wrapper.db.exec('SELECT last_insert_rowid() as id');
        const lastId = idResult?.[0]?.values?.[0]?.[0];
        const changes = wrapper.db.getRowsModified();
        return { lastInsertRowid: lastId, changes };
      },
      get(...params) {
        const stmt = wrapper.db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all(...params) {
        const stmt = wrapper.db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
    };
  }

  exec(sql) {
    this.db.run(sql);
    saveDatabase(this.db);
  }

  pragma(sql) {
    this.db.run(`PRAGMA ${sql}`);
  }
}

const initDatabase = async () => {
  if (dbWrapper) return dbWrapper;

  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(config.database.path)) {
    const buffer = fs.readFileSync(config.database.path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  dbWrapper = new DbWrapper(db);
  return dbWrapper;
};

const getDb = () => {
  if (!dbWrapper) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return dbWrapper;
};

module.exports = {
  initDatabase,
  getDb,
};
