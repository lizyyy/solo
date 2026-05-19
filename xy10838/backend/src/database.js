const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/database.json');
let db = {};

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      const dataDir = path.join(__dirname, '../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(dbPath)) {
        const content = fs.readFileSync(dbPath, 'utf8');
        db = JSON.parse(content);
      } else {
        db = {
          data_domains: [],
          retention_rules: [],
          deletion_requests: [],
          execution_tasks: [],
          failed_items: [],
          customer_receipts: [],
          audit_logs: []
        };
        saveDatabase();
      }

      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const saveDatabase = () => {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};

const getNow = () => new Date().toISOString();

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      if (sql.startsWith('INSERT INTO')) {
        const match = sql.match(/INSERT INTO (\w+)/);
        if (match) {
          const table = match[1];
          if (!db[table]) db[table] = [];
          
          const columnsMatch = sql.match(/\(([^)]+)\)/);
          const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];
          
          const valuesMatch = sql.match(/VALUES \(([^)]+)\)/);
          const placeholders = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
          
          const row = { id: params[placeholders.indexOf('?')] || uuidv4() };
          columns.forEach((col, idx) => {
            if (col !== 'id') {
              const paramIdx = placeholders.indexOf('?', idx > 0 ? placeholders.indexOf('?') + 1 : 0);
              if (paramIdx !== -1) {
                row[col] = params[paramIdx];
              }
            }
          });
          
          db[table].push(row);
          saveDatabase();
          resolve({ lastID: row.id, changes: 1 });
        }
      } else if (sql.startsWith('UPDATE')) {
        const match = sql.match(/UPDATE (\w+)/);
        if (match) {
          const table = match[1];
          const setMatch = sql.match(/SET (.+?) WHERE/);
          const whereMatch = sql.match(/WHERE (.+)$/);
          
          let changes = 0;
          if (db[table]) {
            db[table].forEach(row => {
              const shouldUpdate = !whereMatch || evalWhere(whereMatch[1], params);
              if (shouldUpdate) {
                changes++;
              }
            });
          }
          saveDatabase();
          resolve({ changes });
        }
      }
      
      resolve({ changes: 0 });
    } catch (err) {
      reject(err);
    }
  });
};

const evalWhere = (condition, params) => {
  return true;
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      if (sql.includes('COUNT(*)')) {
        const match = sql.match(/FROM (\w+)/);
        if (match) {
          const table = match[1];
          const count = db[table] ? db[table].length : 0;
          resolve({ count });
        }
      } else if (sql.includes('SELECT * FROM') || sql.includes('SELECT ')) {
        const fromMatch = sql.match(/FROM (\w+)/);
        if (fromMatch) {
          const table = fromMatch[1];
          const whereMatch = sql.match(/WHERE ([^=]+) = \?/);
          
          if (whereMatch && params.length > 0) {
            const field = whereMatch[1].trim();
            const value = params[0];
            const result = db[table] ? db[table].find(row => row[field] === value) : undefined;
            resolve(result);
          } else {
            resolve(db[table] && db[table].length > 0 ? db[table][0] : undefined);
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
          const results = db[table] ? db[table].filter(row => row[field] === value) : [];
          resolve(results);
        } else {
          resolve(db[table] || []);
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
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  uuid: uuidv4,
  getNow
};
