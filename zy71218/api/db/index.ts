import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'data', 'factoring.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  const migrationPath = path.join(__dirname, '..', '..', 'migrations', '001_init.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSQL);
  console.log('Database initialized successfully');
}

export default db;
