const db = require("./index");

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, batch_no TEXT UNIQUE NOT NULL, store_code TEXT NOT NULL, store_name TEXT NOT NULL, operator TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'created', total_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, pending_count INTEGER DEFAULT 0, blocked_count INTEGER DEFAULT 0, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      db.run("CREATE TABLE IF NOT EXISTS raw_materials (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, line_number INTEGER NOT NULL, raw_data TEXT NOT NULL, file_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      db.run("CREATE TABLE IF NOT EXISTS point_details (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, raw_material_id TEXT NOT NULL, member_phone TEXT, member_name TEXT, member_card_no TEXT, transaction_no TEXT, transaction_time DATETIME, transaction_amount REAL, points INTEGER, product_name TEXT, product_category TEXT, sales_staff TEXT, status TEXT NOT NULL DEFAULT 'pending', status_reason TEXT, next_action TEXT, is_valid BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      db.run("CREATE TABLE IF NOT EXISTS processing_traces (id TEXT PRIMARY KEY, detail_id TEXT NOT NULL, batch_id TEXT NOT NULL, action TEXT NOT NULL, operator TEXT, old_status TEXT, new_status TEXT, reason TEXT, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      db.run("CREATE TABLE IF NOT EXISTS write_back_records (id TEXT PRIMARY KEY, detail_id TEXT NOT NULL, batch_id TEXT NOT NULL, external_system TEXT, write_back_status TEXT NOT NULL, write_back_time DATETIME, response_data TEXT, error_message TEXT, retry_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
      console.log("数据库表初始化完成");
      resolve();
    });
  });
};

module.exports = initDatabase;
