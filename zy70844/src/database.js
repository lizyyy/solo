const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'store.db');
const db = new sqlite3.Database(dbPath);
function initDatabase() { return Promise.resolve(); }
function run(sql, params) { params = params || []; return new Promise((res, rej) => db.run(sql, params, function(e) { if (e) rej(e); else res({lastID: this.lastID}); })); }
function get(sql, params) { params = params || []; return new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r))); }
function all(sql, params) { params = params || []; return new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r))); }
module.exports = { db, initDatabase, run, get, all };
