const db = require('./database');

const schema = {
  rooms: `
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      capacity INTEGER DEFAULT 0,
      base_rate_per_hour DECIMAL(10,2) NOT NULL,
      equipment TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  devices: `
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT,
      serial_number TEXT UNIQUE,
      rental_rate_per_hour DECIMAL(10,2) DEFAULT 0,
      deposit_required DECIMAL(10,2) DEFAULT 0,
      status TEXT DEFAULT 'available',
      condition TEXT DEFAULT 'good',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  customers: `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  bookings: `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      actual_start_time DATETIME,
      actual_end_time DATETIME,
      status TEXT NOT NULL DEFAULT 'pending_confirmation',
      base_amount DECIMAL(10,2) DEFAULT 0,
      device_amount DECIMAL(10,2) DEFAULT 0,
      overtime_amount DECIMAL(10,2) DEFAULT 0,
      damage_amount DECIMAL(10,2) DEFAULT 0,
      deposit_amount DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(10,2) DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `,
  
  booking_devices: `
    CREATE TABLE IF NOT EXISTS booking_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      rental_rate DECIMAL(10,2) NOT NULL,
      deposit_required DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'reserved',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (device_id) REFERENCES devices(id),
      UNIQUE(booking_id, device_id)
    )
  `,
  
  deposit_transactions: `
    CREATE TABLE IF NOT EXISTS deposit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT,
      reference_number TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `,
  
  damage_records: `
    CREATE TABLE IF NOT EXISTS damage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      device_id INTEGER,
      room_id INTEGER,
      damage_type TEXT NOT NULL,
      description TEXT NOT NULL,
      estimated_cost DECIMAL(10,2) DEFAULT 0,
      actual_cost DECIMAL(10,2),
      status TEXT DEFAULT 'reported',
      reported_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `,
  
  shifts: `
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_date DATE NOT NULL,
      shift_name TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      staff_name TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  shift_transactions: `
    CREATE TABLE IF NOT EXISTS shift_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      booking_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `,
  
  booking_status_logs: `
    CREATE TABLE IF NOT EXISTS booking_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `
};

function initDatabase() {
  for (const [table, sql] of Object.entries(schema)) {
    db.exec(sql);
    console.log(`表 ${table} 已初始化`);
  }
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_time)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_end ON bookings(end_time)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id)',
    'CREATE INDEX IF NOT EXISTS idx_deposit_booking ON deposit_transactions(booking_id)',
    'CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date)',
  ];
  
  for (const idx of indexes) {
    db.exec(idx);
  }
  console.log('索引已创建');
}

module.exports = { initDatabase };
