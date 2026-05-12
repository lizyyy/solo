const { exec } = require('./database');

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_code TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    city TEXT,
    developer TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    property_code TEXT UNIQUE NOT NULL,
    building_no TEXT,
    unit_no TEXT,
    room_no TEXT,
    floor INTEGER,
    area REAL,
    total_price REAL,
    status TEXT NOT NULL DEFAULT 'available',
    current_booking_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    channel_code TEXT UNIQUE NOT NULL,
    channel_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    commission_rate REAL DEFAULT 0.03,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    id_card_no TEXT,
    channel_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    booking_code TEXT UNIQUE NOT NULL,
    property_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    channel_id TEXT,
    status TEXT NOT NULL,
    total_price REAL,
    booking_amount REAL,
    deposit_amount REAL,
    expiry_time TEXT,
    lock_source TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    deposit_code TEXT UNIQUE NOT NULL,
    booking_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    transaction_no TEXT,
    status TEXT NOT NULL,
    callback_id TEXT,
    paid_at TEXT,
    failure_reason TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS name_change_applications (
    id TEXT PRIMARY KEY,
    application_code TEXT UNIQUE NOT NULL,
    booking_id TEXT NOT NULL,
    old_customer_id TEXT NOT NULL,
    new_customer_id TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL,
    approver TEXT,
    approval_notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    refund_code TEXT UNIQUE NOT NULL,
    booking_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    status TEXT NOT NULL,
    approver TEXT,
    refund_method TEXT,
    transaction_no TEXT,
    refunded_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    commission_code TEXT UNIQUE NOT NULL,
    booking_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    settlement_no TEXT,
    settled_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS manual_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT,
    operator TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
  `CREATE INDEX IF NOT EXISTS idx_deposits_booking ON deposits(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_commissions_booking ON commissions(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_status_history_entity ON status_history(entity_type, entity_id)`
];

const initSchema = () => {
  createTableStatements.forEach(stmt => {
    try {
      exec(stmt);
    } catch (e) {
      console.warn('Schema init warning:', e.message);
    }
  });
  console.log('数据库Schema初始化完成');
};

module.exports = { initSchema };
