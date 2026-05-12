const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbPath = config.DB_PATH || './data/conversations.json';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let database = null;

const loadDB = () => {
  if (database) return database;
  
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      database = JSON.parse(data);
    } catch (e) {
      database = getEmptyDB();
    }
  } else {
    database = getEmptyDB();
  }
  
  return database;
};

const saveDB = () => {
  if (database) {
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf8');
  }
};

const getEmptyDB = () => ({
  conversations: [],
  messages: [],
  intents: [],
  emotions: [],
  escalation_requests: [],
  queue_entries: [],
  agents: [],
  agent_handlers: [],
  corrections: [],
  processing_results: [],
  timeline_events: [],
  idempotency_logs: []
});

const now = () => new Date().toISOString();

const prepare = (table) => {
  loadDB();
  return {
    run: (...args) => {
      if (!database[table]) {
        database[table] = [];
      }
      database[table].push(args[0]);
      saveDB();
    },
    get: (predicate) => {
      return database[table]?.find(predicate);
    },
    all: (predicate) => {
      const data = database[table] || [];
      return predicate ? data.filter(predicate) : data;
    },
    update: (predicate, updater) => {
      const items = database[table] || [];
      let updated = false;
      for (let i = 0; i < items.length; i++) {
        if (predicate(items[i])) {
          items[i] = { ...items[i], ...updater(items[i]) };
          updated = true;
        }
      }
      if (updated) saveDB();
      return updated;
    },
    delete: (predicate) => {
      const before = database[table]?.length || 0;
      if (predicate) {
        database[table] = (database[table] || []).filter(item => !predicate(item));
      } else {
        database[table] = [];
      }
      saveDB();
      return before - (database[table]?.length || 0);
    }
  };
};

const pragma = () => {};

const exec = (sql) => {};

module.exports = {
  prepare,
  pragma,
  exec,
  loadDB,
  saveDB,
  now
};
