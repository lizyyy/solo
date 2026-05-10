async function debug() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  
  const db = new SQL.Database();
  
  db.run(`CREATE TABLE test (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    val REAL
  )`);
  
  console.log('Testing INSERT...');
  db.run('INSERT INTO test (id, name, is_active, val) VALUES (?, ?, ?, ?)', ['test_001', 'Test Name', 1, 500.5]);
  
  console.log('\nTesting SELECT with ? params...');
  try {
    const results1 = db.exec('SELECT * FROM test WHERE id = ?', ['test_001']);
    console.log('exec with params:', results1);
  } catch (err) {
    console.log('exec with params error:', err.message);
  }
  
  console.log('\nTesting prepare...');
  try {
    const stmt = db.prepare('SELECT * FROM test WHERE id = ?');
    stmt.bind(['test_001']);
    if (stmt.step()) {
      console.log('prepare result:', stmt.getAsObject());
    }
  } catch (err) {
    console.log('prepare error:', err.message);
  }
  
  console.log('\nTesting SELECT * ...');
  const results2 = db.exec('SELECT * FROM test');
  console.log('all records:', results2);
  
  console.log('\nChecking type of is_active...');
  const all = db.exec('SELECT * FROM test');
  if (all.length > 0) {
    console.log('columns:', all[0].columns);
    console.log('values:', all[0].values);
    if (all[0].values.length > 0) {
      console.log('is_active value:', all[0].values[0][2], 'type:', typeof all[0].values[0][2]);
      console.log('val value:', all[0].values[0][3], 'type:', typeof all[0].values[0][3]);
    }
  }
  
  db.close();
}

debug().catch(err => console.error(err));
