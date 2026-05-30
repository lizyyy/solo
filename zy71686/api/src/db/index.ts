import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/guarantee_circle.db');
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  const migrationsDir = path.join(__dirname, '../../migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    return;
  }
  
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );
  
  for (const file of migrationFiles) {
    if (!appliedMigrations.has(file)) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      console.log(`Applied migration: ${file}`);
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function transaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDb();
  const result = database.transaction(() => fn(database))();
  return result;
}
