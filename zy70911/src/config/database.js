const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "../data/database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("db error:", err.message);
  else console.log("db connected");
});
function initDatabase() {
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run("CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, material_hash TEXT UNIQUE, status TEXT, operator TEXT, remark TEXT, created_at INTEGER, updated_at INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS refund_records (id TEXT PRIMARY KEY, batch_id TEXT, order_no TEXT, payment_channel TEXT, pile_start_log TEXT, customer_service_remark TEXT, amount REAL, charge_duration INTEGER, start_time INTEGER, end_time INTEGER, pile_id TEXT, user_id TEXT, conclusion TEXT, conclusion_reason TEXT, operator TEXT, created_at INTEGER, updated_at INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, record_id TEXT, batch_id TEXT, field_name TEXT, old_value TEXT, new_value TEXT, operator TEXT, reason TEXT, created_at INTEGER)");
      resolve();
    });
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}
module.exports = { initDatabase, run, get, all, db };
