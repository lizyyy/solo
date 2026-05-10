import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../data/piano.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        openTime TEXT,
        closeTime TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        storeId TEXT NOT NULL,
        name TEXT NOT NULL,
        capacity INTEGER,
        pricePerHour REAL DEFAULT 50,
        status TEXT DEFAULT 'available',
        equipment TEXT,
        FOREIGN KEY (storeId) REFERENCES stores(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        vipLevel TEXT DEFAULT 'normal',
        createdAt TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        storeId TEXT NOT NULL,
        roomId TEXT NOT NULL,
        customerId TEXT,
        customerName TEXT,
        customerPhone TEXT,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        originalStartTime TEXT,
        originalEndTime TEXT,
        originalRoomId TEXT,
        status TEXT DEFAULT 'pending',
        checkInTime TEXT,
        checkOutTime TEXT,
        totalPrice REAL DEFAULT 0,
        paidAmount REAL DEFAULT 0,
        lateMinutes INTEGER DEFAULT 0,
        isExtended INTEGER DEFAULT 0,
        extendCount INTEGER DEFAULT 0,
        notes TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (storeId) REFERENCES stores(id),
        FOREIGN KEY (roomId) REFERENCES rooms(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS status_logs (
        id TEXT PRIMARY KEY,
        bookingId TEXT NOT NULL,
        fromStatus TEXT,
        toStatus TEXT,
        operator TEXT,
        reason TEXT,
        createdAt TEXT,
        FOREIGN KEY (bookingId) REFERENCES bookings(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS revenue_records (
        id TEXT PRIMARY KEY,
        bookingId TEXT,
        storeId TEXT,
        customerId TEXT,
        amount REAL,
        paymentMethod TEXT,
        createdAt TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  });
}
