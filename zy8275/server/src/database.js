import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
let dbPath = null;

export const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  dbPath = path.join(__dirname, '..', 'data', 'construction.db');
  const dataDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  console.log('Database initialized');
  return db;
};

export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const saveDatabase = () => {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

export const exec = (sql, params = []) => {
  const database = getDatabase();
  
  try {
    const stmt = database.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();
    
    saveDatabase();
    return results;
  } catch (error) {
    console.error('SQL Error:', error);
    throw error;
  }
};

export const run = (sql, params = []) => {
  const database = getDatabase();
  
  try {
    database.run(sql, params);
    saveDatabase();
    return { changes: database.getRowsModified() };
  } catch (error) {
    console.error('SQL Error:', error);
    throw error;
  }
};

export const prepare = (sql) => {
  const database = getDatabase();
  
  return {
    run: (...params) => {
      try {
        const stmt = database.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        const result = stmt.step();
        stmt.free();
        saveDatabase();
        return { changes: database.getRowsModified(), lastInsertRowid: database.exec('SELECT last_insert_rowid() as id')[0]?.id };
      } catch (error) {
        console.error('SQL Error:', error);
        throw error;
      }
    },
    get: (...params) => {
      try {
        const stmt = database.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      } catch (error) {
        console.error('SQL Error:', error);
        throw error;
      }
    },
    all: (...params) => {
      try {
        const stmt = database.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } catch (error) {
        console.error('SQL Error:', error);
        throw error;
      }
    }
  };
};

export default {
  initDatabase,
  getDatabase,
  saveDatabase,
  exec,
  run,
  prepare
};
