const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../rescue.db');
const db = sqlite3(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS technicians (
      technicianId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      skills TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      rating REAL DEFAULT 4.5,
      location TEXT,
      currentOrderId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (currentOrderId) REFERENCES rescue_orders(orderId)
    );

    CREATE TABLE IF NOT EXISTS memberships (
      membershipId TEXT PRIMARY KEY,
      ownerName TEXT NOT NULL,
      ownerPhone TEXT NOT NULL,
      remainingTimes INTEGER DEFAULT 3,
      expireDate TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS rescue_orders (
      orderId TEXT PRIMARY KEY,
      vehiclePlate TEXT NOT NULL,
      vehicleModel TEXT,
      ownerName TEXT NOT NULL,
      ownerPhone TEXT NOT NULL,
      location TEXT NOT NULL,
      breakdownType TEXT NOT NULL,
      description TEXT,
      membershipId TEXT,
      status TEXT DEFAULT 'CREATED',
      technicianId TEXT,
      matchedAt INTEGER,
      departedAt INTEGER,
      arrivedAt INTEGER,
      completedAt INTEGER,
      cancelledAt INTEGER,
      actualCost REAL DEFAULT 0,
      estimatedCost REAL DEFAULT 0,
      isRepeat INTEGER DEFAULT 0,
      originalOrderId TEXT,
      parentOrderId TEXT,
      reassignCount INTEGER DEFAULT 0,
      remark TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (technicianId) REFERENCES technicians(technicianId),
      FOREIGN KEY (membershipId) REFERENCES memberships(membershipId)
    );

    CREATE TABLE IF NOT EXISTS fee_records (
      recordId TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      membershipId TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      timesUsed INTEGER DEFAULT 0,
      description TEXT,
      operatorId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (orderId) REFERENCES rescue_orders(orderId),
      FOREIGN KEY (membershipId) REFERENCES memberships(membershipId)
    );

    CREATE TABLE IF NOT EXISTS order_status_logs (
      logId TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      fromStatus TEXT,
      toStatus TEXT NOT NULL,
      operatorId TEXT,
      remark TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (orderId) REFERENCES rescue_orders(orderId)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON rescue_orders(vehiclePlate);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON rescue_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON rescue_orders(createdAt);
    CREATE INDEX IF NOT EXISTS idx_fees_order ON fee_records(orderId);
  `);

  const techCount = db.prepare('SELECT COUNT(*) as count FROM technicians').get().count;
  if (techCount === 0) {
    const insertTech = db.prepare(`
      INSERT INTO technicians (technicianId, name, phone, skills, status, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertTech.run('TECH001', '王师傅', '13900139001', JSON.stringify(['tire', 'battery', 'lock']), 'available', '北京市朝阳区');
    insertTech.run('TECH002', '李师傅', '13900139002', JSON.stringify(['tire', 'fuel', 'tow']), 'available', '北京市海淀区');
    insertTech.run('TECH003', '张师傅', '13900139003', JSON.stringify(['battery', 'fuel', 'lock']), 'available', '北京市丰台区');
    insertTech.run('TECH004', '赵师傅', '13900139004', JSON.stringify(['tow', 'tire', 'battery']), 'available', '北京市昌平区');
  }

  const memberCount = db.prepare('SELECT COUNT(*) as count FROM memberships').get().count;
  if (memberCount === 0) {
    const insertMember = db.prepare(`
      INSERT INTO memberships (membershipId, ownerName, ownerPhone, remainingTimes, expireDate, isActive)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    insertMember.run('VIP001', '张三', '13800138000', 3, nextYear.toISOString().split('T')[0], 1);
    insertMember.run('VIP002', '李四', '13800138001', 5, nextYear.toISOString().split('T')[0], 1);
    insertMember.run('VIP003', '王五', '13800138002', 0, lastMonth.toISOString().split('T')[0], 0);
  }

  console.log('数据库初始化完成');
}

function closeDatabase() {
  db.close();
}

module.exports = {
  db,
  initDatabase,
  closeDatabase
};