const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const csv = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const dbPath = path.join(__dirname, "./data/demo.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = new sqlite3.Database(dbPath);

console.log("Hello World!");
console.log("Dependencies loaded successfully!");

function initDB() {
  return new Promise((res, rej) => {
    db.serialize(() => {
      db.run("CREATE TABLE batches (id TEXT PRIMARY KEY, batch_no TEXT, name TEXT, created_by TEXT)");
      db.run("CREATE TABLE claims (id TEXT, batch_id TEXT, baggage_tag_no TEXT, passenger_name TEXT, flight_date DATE, route TEXT, claim_amount DECIMAL, compensation_level TEXT, responsible_segment TEXT, is_overdue INTEGER, needs_manual_review INTEGER, review_reason TEXT, status TEXT, status_reason TEXT, handler TEXT)");
      db.run("CREATE TABLE logs (id INTEGER PRIMARY KEY AUTOINCREMENT, claim_id TEXT, action TEXT, reason TEXT, handler TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    }, (err) => err ? rej(err) : res());
  });
}

function runSQL(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { err ? rej(err) : res(this); }));
}

function allSQL(sql, params = []) {
  return   return   return   return   retusql  return   return   return   ? rej(err) : res(rows)));
}
