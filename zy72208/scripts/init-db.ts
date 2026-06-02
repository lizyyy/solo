import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../api/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '../migrations');

function runMigrations() {
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const migrationsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  migrationsTable.run();

  const appliedMigrations = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
  const appliedNames = new Set(appliedMigrations.map(m => m.name));

  for (const file of migrationFiles) {
    if (appliedNames.has(file)) {
      console.log(`[DB] Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const statements = sql.split(';').filter(s => s.trim());

    const transaction = db.transaction(() => {
      for (const stmt of statements) {
        db.exec(stmt);
      }
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
    });

    transaction();
    console.log(`[DB] Applied migration: ${file}`);
  }

  console.log('[DB] All migrations completed successfully');
}

try {
  runMigrations();
  process.exit(0);
} catch (error) {
  console.error('[DB] Migration failed:', error);
  process.exit(1);
}
