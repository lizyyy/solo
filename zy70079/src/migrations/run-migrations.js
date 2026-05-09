const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`Running migration: ${file}`);
    try {
      await query(sql);
      console.log(`✓ Migration ${file} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${file} failed:`, error.message);
      throw error;
    }
  }

  console.log('All migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
