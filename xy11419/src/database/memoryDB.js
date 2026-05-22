const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'data.json');

let data = {
  batches: [],
  work_orders: [],
  status_transitions: [],
  evidences: [],
  materials: [],
  async_tasks: [],
  audit_logs: [],
  users: []
};

function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function load() {
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      data = JSON.parse(content);
    } catch (e) {
      console.log('数据文件损坏，使用空数据库');
    }
  }
}

function prepare(sql) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i);
  const table = tableMatch ? tableMatch[1] : '';
  
  return {
    get(...params) {
      if (sql.includes('SELECT COUNT')) {
        let result.rows = data[table] || [];
        return { total: result.rows.length };
      }
      
      let rows = data[table] || [];
      return rows[0] || null;
    },
    all(...params) {
      return data[table] || [];
    },
    run(...params) {
      if (sql.startsWith('INSERT')) {
        const obj = {};
        const cols = sql.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim());
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = params[i];
        }
        data[table].push(obj);
        save();
      } else if (sql.startsWith('UPDATE')) {
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
        const whereMatch = sql.match(/WHERE\s+(.+)/i);
        const sets = setMatch ? setMatch[1].split(',').map(s => s.trim()) : [];
        const where = whereMatch ? whereMatch[1].trim() : '';
        
        let rows = data[table] || [];
        rows.forEach(row => {
          sets.forEach(set => {
            const [key, val] = set.split('=').map(s => s.trim());
            row[key.replace(/\?/g, params.shift())] = params.shift();
          });
        });
        save();
      } else if (sql.startsWith('DELETE')) {
        data[table] = [];
        save();
      }
    }
  };
}

load();

module.exports = {
  prepare,
  exec: (sql) => {},
  pragma: () => {},
  serialize: (fn) => fn(),
  transaction: (fn) => fn(),
  data
};
