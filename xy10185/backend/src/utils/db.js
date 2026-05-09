const { initDatabase, saveDatabase, getDatabase } = require('../../db/init');

let dbReady = false;

async function ensureDbReady() {
  if (!dbReady) {
    await initDatabase();
    dbReady = true;
  }
}

function runQuery(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDatabase();
  
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]
  };
}

function queryAll(sql, params = []) {
  const db = getDatabase();
  const results = db.exec(sql, params);
  
  if (!results || results.length === 0) return [];
  
  const result = results[0];
  const columns = result.columns;
  
  return result.values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

function beginTransaction(fn) {
  const db = getDatabase();
  try {
    db.run('BEGIN TRANSACTION');
    const result = fn();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

module.exports = {
  ensureDbReady,
  runQuery,
  queryAll,
  queryOne,
  beginTransaction
};