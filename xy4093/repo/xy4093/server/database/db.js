import Database from 'better-sqlite3';
import { DATABASE_PATH, SCHEMAS, INDEXES } from './schema.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function ensureDataDirectory() {
  const dataDir = join(__dirname, '../../data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    ensureDataDirectory();
    const dbPath = join(__dirname, '../../data/typhoon.db');
    dbInstance = new Database(dbPath);
    
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

function initializeDatabase(db) {
  const transaction = db.transaction(() => {
    for (const [table, schema] of Object.entries(SCHEMAS)) {
      db.exec(schema);
    }
    
    for (const index of INDEXES) {
      db.exec(index);
    }
    
    insertDefaultSupplies(db);
  });
  
  transaction();
  console.log('数据库初始化完成');
}

function insertDefaultSupplies(db) {
  const defaultSupplies = [
    { type: 'fuel', name: '发电机柴油', quantity: 500, unit: '升', min_threshold: 100 },
    { type: 'water', name: '瓶装饮用水', quantity: 200, unit: '瓶', min_threshold: 50 },
    { type: 'water', name: '桶装饮用水', quantity: 50, unit: '桶', min_threshold: 20 },
    { type: 'food', name: '方便面', quantity: 100, unit: '包', min_threshold: 30 },
    { type: 'medicine', name: '急救包', quantity: 10, unit: '个', min_threshold: 5 },
  ];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO supplies (id, type, name, quantity, unit, min_threshold, status)
    VALUES (@id, @type, @name, @quantity, @unit, @min_threshold, 
      CASE WHEN @quantity >= @min_threshold THEN 'sufficient' ELSE 'low' END)
  `);
  
  for (const supply of defaultSupplies) {
    insert.run({
      id: `supply_${supply.type}_${supply.name}`,
      ...supply
    });
  }
}

export function runQuery(sql, params = []) {
  const db = getDatabase();
  try {
    return db.prepare(sql).run(params);
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

export function getOne(sql, params = []) {
  const db = getDatabase();
  try {
    return db.prepare(sql).get(params);
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

export function getAll(sql, params = []) {
  const db = getDatabase();
  try {
    return db.prepare(sql).all(params);
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default getDatabase;
