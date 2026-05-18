const db = require('../config/database');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS car_wash_devices (
        device_id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        station_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        device_type TEXT NOT NULL,
        status TEXT NOT NULL,
        last_heartbeat_at DATETIME,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS coupons (
        coupon_id TEXT PRIMARY KEY,
        coupon_code TEXT NOT NULL UNIQUE,
        coupon_type TEXT NOT NULL,
        discount_amount REAL NOT NULL,
        min_consumption REAL DEFAULT 0,
        user_id TEXT NOT NULL,
        user_phone TEXT,
        status TEXT NOT NULL,
        valid_start_at DATETIME NOT NULL,
        valid_end_at DATETIME NOT NULL,
        used_at DATETIME,
        used_device_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS car_wash_orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_phone TEXT,
        device_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        car_plate TEXT,
        wash_type TEXT NOT NULL,
        original_amount REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        actual_amount REAL NOT NULL,
        coupon_id TEXT,
        status TEXT NOT NULL,
        start_time DATETIME,
        end_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discount_freezes (
        freeze_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        coupon_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        freeze_amount REAL NOT NULL,
        freeze_reason TEXT NOT NULL,
        status TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        audit_remark TEXT,
        audit_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discount_exceptions (
        exception_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        coupon_id TEXT,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        station_id TEXT NOT NULL,
        exception_type TEXT NOT NULL,
        exception_code TEXT NOT NULL,
        exception_message TEXT NOT NULL,
        coupon_consumed INTEGER NOT NULL DEFAULT 0,
        device_failed INTEGER NOT NULL DEFAULT 0,
        consistency_status TEXT NOT NULL,
        handle_status TEXT NOT NULL,
        handler_id TEXT,
        handler_name TEXT,
        handle_remark TEXT,
        handle_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      console.log('数据库表初始化完成');
      resolve();
    });
  });
};

module.exports = initDatabase;
