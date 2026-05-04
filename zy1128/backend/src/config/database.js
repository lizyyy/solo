import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../data/finance.db');

const db = new Database(dbPath, { verbose: console.log });

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
