import Database from 'better-sqlite3';
import { initDatabase } from './init';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (!db) {
    db = initDatabase();
  }
  return db;
};

export const closeDb = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

export default getDb;
