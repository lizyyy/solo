const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'scheduling.json');

let db = {
  stores: [],
  skills: [],
  employees: [],
  employeeSkills: [],
  schedules: [],
  transferRequests: [],
  transportAllowanceRules: []
};

let nextIds = {
  stores: 1,
  skills: 1,
  employees: 1,
  schedules: 1,
  transferRequests: 1,
  transportAllowanceRules: 1
};

const loadDB = () => {
  if (fs.existsSync(dbPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      db = {
        stores: data.stores || [],
        skills: data.skills || [],
        employees: data.employees || [],
        employeeSkills: data.employeeSkills || [],
        schedules: data.schedules || [],
        transferRequests: data.transferRequests || [],
        transportAllowanceRules: data.transportAllowanceRules || []
      };
      
      nextIds.stores = db.stores.length > 0 ? Math.max(...db.stores.map(s => s.id)) + 1 : 1;
      nextIds.skills = db.skills.length > 0 ? Math.max(...db.skills.map(s => s.id)) + 1 : 1;
      nextIds.employees = db.employees.length > 0 ? Math.max(...db.employees.map(e => e.id)) + 1 : 1;
      nextIds.schedules = db.schedules.length > 0 ? Math.max(...db.schedules.map(s => s.id)) + 1 : 1;
      nextIds.transferRequests = db.transferRequests.length > 0 ? Math.max(...db.transferRequests.map(r => r.id)) + 1 : 1;
      nextIds.transportAllowanceRules = db.transportAllowanceRules.length > 0 ? Math.max(...db.transportAllowanceRules.map(r => r.id)) + 1 : 1;
      
      return true;
    } catch (e) {
      console.error('Failed to load database:', e);
      return false;
    }
  }
  return false;
};

const saveDB = () => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save database:', e);
    return false;
  }
};

const prepare = (table) => {
  return {
    all: () => [...db[table]],
    get: (id) => db[table].find(item => item.id === id),
    find: (predicate) => db[table].find(predicate),
    filter: (predicate) => db[table].filter(predicate),
    insert: (data) => {
      const item = {
        id: nextIds[table]++,
        created_at: new Date().toISOString(),
        ...data
      };
      db[table].push(item);
      saveDB();
      return { lastInsertRowid: item.id, changes: 1 };
    },
    update: (id, data) => {
      const index = db[table].findIndex(item => item.id === id);
      if (index !== -1) {
        db[table][index] = { ...db[table][index], ...data };
        saveDB();
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    delete: (id) => {
      const index = db[table].findIndex(item => item.id === id);
      if (index !== -1) {
        db[table].splice(index, 1);
        saveDB();
        return { changes: 1 };
      }
      return { changes: 0 };
    }
  };
};

const exec = (sql) => {
  saveDB();
};

const pragma = () => {};

const initDB = () => {
  loadDB();
};

module.exports = {
  db,
  initDB,
  saveDB,
  prepare,
  exec,
  pragma
};
