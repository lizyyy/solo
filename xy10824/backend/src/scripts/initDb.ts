import { getDb, runQuery } from '../database/db';
import { createTablesSQL } from '../database/schema';

async function initDatabase() {
  console.log('Initializing database...');
  
  const db = await getDb();
  
  const tables = [
    'inventory_pool',
    'reservation',
    'timeout_task',
    'release_record',
    'compensation_action',
    'inventory_log',
  ];

  for (const table of tables) {
    await new Promise<void>((resolve, reject) => {
      db.run(`DROP TABLE IF EXISTS ${table}`, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  const statements = createTablesSQL.split(';').filter(s => s.trim());
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      await new Promise<void>((resolve, reject) => {
        db.run(stmt, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  console.log('Database tables created successfully');
  console.log('Database initialization complete');
}

initDatabase().catch(console.error);