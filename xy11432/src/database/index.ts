import Database from 'better-sqlite3';
import { createTables } from './schema';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.join(dbDir, 'lab_consumable_queue.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(createTables);

process.on('exit', () => {
  db.close();
});

export default db;
