import * as fs from 'fs';
import * as path from 'path';
import { Database } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tour-db.json');

const INITIAL_DB: Database = {
  equipmentCases: [],
  cities: [],
  tourManifests: [],
  borrowRecords: [],
  damageRecords: [],
  repairRecords: [],
  compensationActions: [],
};

let cachedDB: Database | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDB(): Database {
  if (cachedDB) return { ...cachedDB };
  
  ensureDataDir();
  
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
    cachedDB = { ...INITIAL_DB };
    return cachedDB;
  }
  
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    cachedDB = JSON.parse(content) as Database;
    return { ...cachedDB };
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
    cachedDB = { ...INITIAL_DB };
    return cachedDB;
  }
}

function saveDB(db: Database): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  cachedDB = db;
}

export function getDB(): Database {
  return loadDB();
}

export function updateDB(updater: (db: Database) => Database): Database {
  const current = loadDB();
  const updated = updater(current);
  saveDB(updated);
  return updated;
}

export function resetDB(): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
  cachedDB = { ...INITIAL_DB };
}

export function getDBPath(): string {
  return DB_FILE;
}
