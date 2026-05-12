const db = require('./config/database');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function transaction(operations) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr => {
        if (beginErr) {
          reject(beginErr);
          return;
        }

        operations()
          .then(() => {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK', () => reject(commitErr));
              } else {
                resolve();
              }
            });
          })
          .catch((err) => {
            db.run('ROLLBACK', () => reject(err));
          });
      });
    });
  });
}

module.exports = {
  run,
  all,
  get,
  exec,
  close,
  transaction
};
