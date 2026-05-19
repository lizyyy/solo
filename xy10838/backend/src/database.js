const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/database.json');

const dbWrapper = {
  _data: {
    data_domains: [],
    retention_rules: [],
    deletion_requests: [],
    execution_tasks: [],
    failed_items: [],
    customer_receipts: [],
    audit_logs: []
  },
  
  get data_domains() { return this._data.data_domains; },
  get retention_rules() { return this._data.retention_rules; },
  get deletion_requests() { return this._data.deletion_requests; },
  get execution_tasks() { return this._data.execution_tasks; },
  get failed_items() { return this._data.failed_items; },
  get customer_receipts() { return this._data.customer_receipts; },
  get audit_logs() { return this._data.audit_logs; },
  
  set data_domains(val) { this._data.data_domains = val; },
  set retention_rules(val) { this._data.retention_rules = val; },
  set deletion_requests(val) { this._data.deletion_requests = val; },
  set execution_tasks(val) { this._data.execution_tasks = val; },
  set failed_items(val) { this._data.failed_items = val; },
  set customer_receipts(val) { this._data.customer_receipts = val; },
  set audit_logs(val) { this._data.audit_logs = val; }
};

const saveDatabase = () => {
  fs.writeFileSync(dbPath, JSON.stringify(dbWrapper._data, null, 2));
};

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      const dataDir = path.join(__dirname, '../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(dbPath)) {
        const content = fs.readFileSync(dbPath, 'utf8');
        const loaded = JSON.parse(content);
        Object.assign(dbWrapper._data, loaded);
      }
      
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const getNow = () => new Date().toISOString();

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      if (sql.startsWith('INSERT INTO')) {
        const match = sql.match(/INSERT INTO (\w+)/);
        if (match) {
          const table = match[1];
          if (dbWrapper[table]) {
            const columnsMatch = sql.match(/\(([^)]+)\)/);
            const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];
            
            const row = { id: params[columns.indexOf('id')] || uuidv4() };
            columns.forEach((col, idx) => {
              if (col !== 'id' && idx < params.length) {
                row[col] = params[idx];
              }
            });
            
            dbWrapper[table].push(row);
            saveDatabase();
            resolve({ lastID: row.id, changes: 1 });
          }
        }
      }
      resolve({ changes: 0 });
    } catch (err) {
      reject(err);
    }
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      if (sql.includes('COUNT(*)')) {
        const match = sql.match(/FROM (\w+)/);
        if (match) {
          const table = match[1];
          const count = dbWrapper[table] ? dbWrapper[table].length : 0;
          resolve({ count });
        }
      } else if (sql.includes('SELECT')) {
        const fromMatch = sql.match(/FROM (\w+)/);
        if (fromMatch) {
          const table = fromMatch[1];
          const whereMatch = sql.match(/WHERE ([^=]+) = \?/);
          
          if (whereMatch && params.length > 0) {
            const field = whereMatch[1].trim();
            const value = params[0];
            const result = dbWrapper[table] ? dbWrapper[table].find(row => row[field] === value) : undefined;
            resolve(result);
          } else {
            resolve(dbWrapper[table] && dbWrapper[table].length > 0 ? dbWrapper[table][0] : undefined);
          }
        }
      }
      resolve(undefined);
    } catch (err) {
      reject(err);
    }
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const fromMatch = sql.match(/FROM (\w+)/);
      if (fromMatch) {
        const table = fromMatch[1];
        const whereMatch = sql.match(/WHERE ([^=]+) = \?/);
        
        if (whereMatch && params.length > 0) {
          const field = whereMatch[1].trim();
          const value = params[0];
          const results = dbWrapper[table] ? dbWrapper[table].filter(row => row[field] === value) : [];
          resolve(results);
        } else {
          resolve(dbWrapper[table] || []);
        }
      } else {
        resolve([]);
      }
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  db: dbWrapper,
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  uuid: uuidv4,
  getNow,
  saveDatabase
};
