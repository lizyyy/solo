import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../data/db.json');

interface Database {
  locations: any[];
  location_aliases: any[];
  resident_feedbacks: any[];
  inspection_photos: any[];
  street_notes: any[];
  plan_versions: any[];
  reports: any[];
  data_conflicts: any[];
  audit_logs: any[];
}

let db: Database = {
  locations: [],
  location_aliases: [],
  resident_feedbacks: [],
  inspection_photos: [],
  street_notes: [],
  plan_versions: [],
  reports: [],
  data_conflicts: [],
  audit_logs: []
};

let idCounters: Record<string, number> = {
  locations: 0,
  location_aliases: 0,
  resident_feedbacks: 0,
  inspection_photos: 0,
  street_notes: 0,
  plan_versions: 0,
  reports: 0,
  data_conflicts: 0,
  audit_logs: 0
};

function loadDatabase() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      const loaded = JSON.parse(data);
      db = loaded.db || db;
      idCounters = loaded.idCounters || idCounters;
    }
  } catch (e) {
    console.log('创建新数据库');
  }
}

function saveDatabase() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify({ db, idCounters }, null, 2));
}

export function initDatabase() {
  loadDatabase();
  console.log('数据库初始化完成 (JSON文件存储)');
}

class Table {
  name: keyof Database;

  constructor(name: keyof Database) {
    this.name = name;
  }

  all() {
    return [...db[this.name]];
  }

  get(id: number) {
    return db[this.name].find((item: any) => item.id === id);
  }

  filter(predicate: (item: any) => boolean) {
    return db[this.name].filter(predicate);
  }

  findOne(predicate: (item: any) => boolean) {
    return db[this.name].find(predicate);
  }

  insert(data: any) {
    idCounters[this.name]++;
    const item = {
      id: idCounters[this.name],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    db[this.name].push(item);
    saveDatabase();
    return { lastInsertRowid: item.id };
  }

  update(id: number, data: any) {
    const index = db[this.name].findIndex((item: any) => item.id === id);
    if (index !== -1) {
      db[this.name][index] = {
        ...db[this.name][index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  delete(id: number) {
    const index = db[this.name].findIndex((item: any) => item.id === id);
    if (index !== -1) {
      db[this.name].splice(index, 1);
      saveDatabase();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  deleteWhere(predicate: (item: any) => boolean) {
    const before = db[this.name].length;
    db[this.name] = db[this.name].filter((item: any) => !predicate(item)) as any;
    saveDatabase();
    return { changes: before - db[this.name].length };
  }

  prepare(sql: string) {
    return {
      all: (...params: any[]) => {
        return this.all();
      },
      get: (...params: any[]) => {
        if (sql.includes('WHERE id = ?')) {
          return this.get(params[0]);
        }
        return this.findOne(() => true);
      },
      run: (...params: any[]) => {
        if (sql.startsWith('INSERT')) {
          const data: any = {};
          const match = sql.match(/INSERT INTO \w+ \(([^)]+)\)/);
          if (match) {
            const columns = match[1].split(',').map((c: string) => c.trim());
            columns.forEach((col: string, i: number) => {
              if (params[i] !== undefined && params[i] !== null) {
                data[col] = params[i];
              }
            });
          }
          return this.insert(data);
        }
        if (sql.startsWith('UPDATE')) {
          const idMatch = sql.match(/WHERE id = \?$/);
          if (idMatch) {
            const id = params[params.length - 1];
            return this.update(id, {});
          }
        }
        if (sql.startsWith('DELETE')) {
          const idMatch = sql.match(/WHERE id = \?$/);
          if (idMatch) {
            return this.delete(params[0]);
          }
        }
        return { changes: 0, lastInsertRowid: 0 };
      }
    };
  }
}

export default {
  prepare: (sql: string) => {
    const match = sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)|DELETE\s+FROM\s+(\w+)/);
    const tableName = match?.[1] || match?.[2] || match?.[3] || match?.[4];
    
    if (tableName) {
      const table = new Table(tableName as keyof Database);
      return table.prepare(sql);
    }
    
    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0, lastInsertRowid: 0 })
    };
  },
  exec: (sql: string) => {
    console.log('SQL exec:', sql.substring(0, 100));
  },
  pragma: () => {},
  locations: new Table('locations'),
  location_aliases: new Table('location_aliases'),
  resident_feedbacks: new Table('resident_feedbacks'),
  inspection_photos: new Table('inspection_photos'),
  street_notes: new Table('street_notes'),
  plan_versions: new Table('plan_versions'),
  reports: new Table('reports'),
  data_conflicts: new Table('data_conflicts'),
  audit_logs: new Table('audit_logs')
};
