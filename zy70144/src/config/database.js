const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/db.json');

let dbCache = null;

const defaultSchema = {
  artifacts: [],
  artifact_metadata: [],
  signatures: [],
  security_scans: [],
  approvals: [],
  promotion_requests: [],
  rollbacks: [],
  gate_rules: [],
  audit_logs: []
};

function loadDatabase() {
  if (dbCache) return dbCache;
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(DB_PATH)) {
    dbCache = JSON.parse(JSON.stringify(defaultSchema));
    saveDatabase();
  } else {
    try {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      dbCache = JSON.parse(content);
      for (const key of Object.keys(defaultSchema)) {
        if (!dbCache[key]) {
          dbCache[key] = [];
        }
      }
    } catch (e) {
      console.warn('数据库文件损坏，使用默认结构:', e.message);
      dbCache = JSON.parse(JSON.stringify(defaultSchema));
    }
  }
  
  return dbCache;
}

function saveDatabase() {
  if (!dbCache) return;
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf-8');
}

function clearCache() {
  dbCache = null;
}

class QueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.conditions = [];
    this.orderByField = null;
    this.orderDirection = 'ASC';
    this.limitCount = null;
  }
  
  where(field, operator, value) {
    this.conditions.push({ field, operator, value });
    return this;
  }
  
  orderBy(field, direction = 'DESC') {
    this.orderByField = field;
    this.orderDirection = direction.toUpperCase();
    return this;
  }
  
  limit(count) {
    this.limitCount = count;
    return this;
  }
  
  _match(item) {
    return this.conditions.every(({ field, operator, value }) => {
      const itemValue = item[field];
      switch (operator) {
        case '=':
        case '==':
          return itemValue == value;
        case '===':
          return itemValue === value;
        case '!=':
          return itemValue != value;
        case '!==':
          return itemValue !== value;
        case '>':
          return itemValue > value;
        case '<':
          return itemValue < value;
        case '>=':
          return itemValue >= value;
        case '<=':
          return itemValue <= value;
        case 'LIKE':
          return String(itemValue).includes(String(value).replace(/%/g, ''));
        default:
          return itemValue === value;
      }
    });
  }
  
  _sort(items) {
    if (!this.orderByField) return items;
    
    return [...items].sort((a, b) => {
      const aVal = a[this.orderByField];
      const bVal = b[this.orderByField];
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      return this.orderDirection === 'DESC' ? -comparison : comparison;
    });
  }
  
  _limit(items) {
    if (this.limitCount === null) return items;
    return items.slice(0, this.limitCount);
  }
  
  all() {
    const db = loadDatabase();
    let items = (db[this.tableName] || []).filter(item => this._match(item));
    items = this._sort(items);
    items = this._limit(items);
    return items;
  }
  
  get() {
    const items = this.all();
    return items[0] || null;
  }
  
  first() {
    return this.get();
  }
  
  count() {
    return this.all().length;
  }
}

function table(tableName) {
  return new QueryBuilder(tableName);
}

function insert(tableName, data) {
  const db = loadDatabase();
  if (!db[tableName]) {
    db[tableName] = [];
  }
  db[tableName].push(data);
  saveDatabase();
  return data;
}

function update(tableName, matcher, updates) {
  const db = loadDatabase();
  const items = db[tableName] || [];
  let updatedCount = 0;
  
  for (let i = 0; i < items.length; i++) {
    let matches = true;
    for (const [key, value] of Object.entries(matcher)) {
      if (items[i][key] !== value) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      items[i] = { ...items[i], ...updates };
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    saveDatabase();
  }
  return updatedCount;
}

function updateById(tableName, id, updates) {
  return update(tableName, { id }, updates);
}

function exec(sql) {
  return null;
}

function prepare(sql) {
  return {
    run: (...params) => {
      return { changes: 0 };
    },
    all: (...params) => {
      return [];
    },
    get: (...params) => {
      return null;
    }
  };
}

module.exports = {
  getDatabase: () => ({
    prepare,
    exec,
    close: () => {}
  }),
  DB_PATH,
  loadDatabase,
  saveDatabase,
  clearCache,
  table,
  insert,
  update,
  updateById,
  defaultSchema
};
