const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/bakery.db');
const db = new sqlite3.Database(dbPath);

class Database {
  static all(sql, ...params) {
    return new Promise((resolve, reject) => {
      db.all(sql, ...params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static get(sql, ...params) {
    return new Promise((resolve, reject) => {
      db.get(sql, ...params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static run(sql, ...params) {
    return new Promise((resolve, reject) => {
      db.run(sql, ...params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
}

module.exports = { db, Database };
