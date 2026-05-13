const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');

let db;
let dbReady = false;

function initDatabase(callback) {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('数据库连接失败:', err.message);
      return callback(err);
    }
    console.log('数据库连接成功');
    
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        orderNo TEXT UNIQUE,
        ownerName TEXT,
        ownerPhone TEXT,
        ownerLocation TEXT,
        ownerLocationLat REAL,
        ownerLocationLng REAL,
        faultType TEXT,
        faultDescription TEXT,
        technicianId TEXT,
        technicianName TEXT,
        technicianLocation TEXT,
        technicianLocationLat REAL,
        technicianLocationLng REAL,
        estimatedArrivalTime INTEGER,
        actualArrivalTime INTEGER,
        status TEXT,
        spareParts TEXT,
        responsiblePerson TEXT,
        cancelReason TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        createdBy TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS order_timeline (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        status TEXT,
        previousStatus TEXT,
        action TEXT,
        reason TEXT,
        operator TEXT,
        changes TEXT,
        createdAt INTEGER,
        FOREIGN KEY (orderId) REFERENCES orders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS technicians (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        status TEXT,
        currentLocation TEXT,
        currentLat REAL,
        currentLng REAL,
        skills TEXT,
        createdAt INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
        id TEXT PRIMARY KEY,
        name TEXT,
        code TEXT UNIQUE,
        quantity INTEGER,
        unit TEXT,
        location TEXT,
        threshold INTEGER,
        updatedAt INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS idempotency (
        id TEXT PRIMARY KEY,
        requestId TEXT UNIQUE,
        orderId TEXT,
        result TEXT,
        createdAt INTEGER
      )`, (err) => {
        if (err) {
          console.error('表创建失败:', err.message);
          return callback(err);
        }
        dbReady = true;
        callback(null);
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

module.exports = { initDatabase, getDb };
