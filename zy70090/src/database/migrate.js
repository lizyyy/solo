const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log('Running migrations...');
    
    for (const file of files) {
      console.log(`  - Executing: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }
    
    await client.query('COMMIT');
    console.log('All migrations completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Database migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database migration failed:', error);
      process.exit(1);
    });
}

module.exports = runMigrations;
