const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run('CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  
  const stmt1 = db.prepare('INSERT INTO test (name) VALUES (?)');
  stmt1.bind(['test1']);
  stmt1.step();
  stmt1.free();
  
  const result1 = db.exec('SELECT last_insert_rowid() as id');
  console.log('After stmt1, last_insert_rowid:', result1[0].values[0][0]);
  
  const stmt2 = db.prepare('INSERT INTO test (name) VALUES (?)');
  stmt2.bind(['test2']);
  stmt2.step();
  stmt2.free();
  
  const result2 = db.exec('SELECT last_insert_rowid() as id');
  console.log('After stmt2, last_insert_rowid:', result2[0].values[0][0]);
  
  const all = db.exec('SELECT * FROM test');
  console.log('All rows:', JSON.stringify(all[0].values));
})();
