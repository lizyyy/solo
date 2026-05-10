const fs = require('fs');
const path = require('path');
const config = require('../config');

let store = null;
let persistPath = null;

function now() {
  return Math.floor(Date.now() / 1000);
}

function autoIncrement(collection) {
  if (collection.length === 0) return 1;
  const maxId = collection.reduce((max, item) => Math.max(max, item.id || 0), 0);
  return maxId + 1;
}

function createEmptyStore() {
  return {
    owners: [],
    query_fingerprints: [],
    slow_queries: [],
    optimization_records: [],
    rerun_results: [],
    exception_logs: [],
    task_queue: [],
    status_history: []
  };
}

function getDb() {
  if (!store) {
    persistPath = config.database.path;
    
    if (fs.existsSync(persistPath)) {
      try {
        store = JSON.parse(fs.readFileSync(persistPath, 'utf8'));
      } catch (e) {
        store = createEmptyStore();
      }
    } else {
      store = createEmptyStore();
    }
  }
  return {
    ...store,
    _save: () => {
      fs.writeFileSync(persistPath, JSON.stringify(store, null, 2));
    }
  };
}

const SQL = {};

function init() {
  const db = getDb();
  
  const systemOwner = db.owners.find(o => o.name === 'system');
  if (!systemOwner) {
    db.owners.push({
      id: autoIncrement(db.owners),
      name: 'system',
      email: 'system@local',
      created_at: now(),
      updated_at: now()
    });
    db._save();
  }
}

function prepareInsert(table, fields) {
  const db = getDb();
  return {
    run(...values) {
      const record = {};
      record.id = autoIncrement(db[table]);
      
      for (let i = 0; i < fields.length; i++) {
        record[fields[i]] = values[i];
      }
      
      if (fields.includes('created_at') && !record.created_at) {
        record.created_at = now();
      }
      if (fields.includes('updated_at') && !record.updated_at) {
        record.updated_at = now();
      }
      
      db[table].push(record);
      db._save();
      
      return { lastInsertRowid: record.id, changes: 1 };
    },
    get(...args) {
      if (fields.length === 1 && fields[0] === '*') {
        const condition = args[0];
        return db[table].find(condition);
      }
      return null;
    }
  };
}

function prepareSelect(table) {
  const db = getDb();
  return {
    all(...params) {
      return db[table].slice();
    },
    get(...params) {
      if (params.length === 1) {
        if (typeof params[0] === 'object') {
          return db[table].find(params[0]);
        }
        if (typeof params[0] === 'number') {
          return db[table].find(item => item.id === params[0]);
        }
      }
      return null;
    }
  };
}

function prepareUpdate(table, updates, condition) {
  const db = getDb();
  return {
    run(...params) {
      let changed = 0;
      
      db[table].forEach(item => {
        if (condition(item, params)) {
          updates.forEach((field, idx) => {
            item[field] = params[idx];
          });
          if (fieldExists('updated_at', table) && !updates.includes('updated_at')) {
            item.updated_at = now();
          }
          changed++;
        }
      });
      
      if (changed > 0) {
        db._save();
      }
      
      return { changes: changed };
    }
  };
}

function fieldExists(field, table) {
  const db = getDb();
  if (db[table].length === 0) return false;
  return field in db[table][0];
}

function findById(table, id) {
  const db = getDb();
  return db[table].find(item => item.id === id);
}

function findOne(table, condition) {
  const db = getDb();
  return db[table].find(condition);
}

function findAll(table, condition = null) {
  const db = getDb();
  if (!condition) return db[table].slice();
  return db[table].filter(condition);
}

function insert(table, record) {
  const db = getDb();
  const newRecord = {
    ...record,
    id: autoIncrement(db[table]),
    created_at: record.created_at || now(),
    updated_at: record.updated_at || now()
  };
  db[table].push(newRecord);
  db._save();
  return newRecord;
}

function update(table, id, updates) {
  const db = getDb();
  const record = db[table].find(item => item.id === id);
  if (!record) return { changes: 0 };
  
  Object.assign(record, updates, { updated_at: now() });
  db._save();
  return { changes: 1 };
}

function remove(table, id) {
  const db = getDb();
  const idx = db[table].findIndex(item => item.id === id);
  if (idx === -1) return { changes: 0 };
  
  db[table].splice(idx, 1);
  db._save();
  return { changes: 1 };
}

module.exports = {
  getDb,
  SQL,
  init,
  findById,
  findOne,
  findAll,
  insert,
  update,
  remove,
  prepareInsert,
  prepareSelect,
  prepareUpdate,
  now
};
