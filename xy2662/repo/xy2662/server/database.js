const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'booking.db');

let db;
let isInitialized = false;
let initPromise;

const STATUS_FLOW = {
  'pending': ['deposited', 'refunded'],
  'deposited': ['verified', 'refunded'],
  'verified': [],
  'refunded': []
};

const STATUS_NAMES = {
  'pending': '待收押金',
  'deposited': '已收押金',
  'verified': '已核销',
  'refunded': '已退款'
};

function getStatusName(status) {
  return STATUS_NAMES[status] || status;
}

function canTransition(fromStatus, toStatus) {
  if (!STATUS_FLOW[fromStatus]) return false;
  return STATUS_FLOW[fromStatus].includes(toStatus);
}

function getAvailableTransitions(status) {
  return STATUS_FLOW[status] || [];
}

function getTransitionReason(fromStatus, toStatus) {
  const nextStatus = getAvailableTransitions(fromStatus);
  if (nextStatus.length === 0) {
    return `当前状态「${getStatusName(fromStatus)}」无法进行状态变更`;
  }
  return `当前状态「${getStatusName(fromStatus)}」只能变更为：${nextStatus.map(s => getStatusName(s)).join('、')}`;
}

function isTimeOverlap(start1, end1, start2, end2) {
  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  
  return s1 < e2 && s2 < e1;
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('已连接到 SQLite 数据库');
      
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            studio TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            deposit_amount REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings (id)
          )
        `);

        db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_studio ON bookings(studio)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_booking ON audit_logs(booking_id)`, (err) => {
          if (err) {
            console.error('创建索引失败:', err);
            reject(err);
          } else {
            console.log('数据库表初始化完成');
            isInitialized = true;
            resolve();
          }
        });
      });
    });
  });
}

function waitForInitialization() {
  if (isInitialized) {
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
}

async function run(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

async function get(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function all(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function checkTimeConflict(studio, bookingDate, startTime, endTime, excludeId = null) {
  await waitForInitialization();
  
  let sql = `
    SELECT * FROM bookings 
    WHERE studio = ? 
      AND booking_date = ? 
      AND status != 'refunded'
  `;
  let params = [studio, bookingDate];

  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  const existingBookings = await all(sql, params);

  for (const booking of existingBookings) {
    if (isTimeOverlap(startTime, endTime, booking.start_time, booking.end_time)) {
      return {
        conflict: true,
        message: `棚位 ${studio} 在 ${bookingDate} ${booking.start_time}-${booking.end_time} 已被预约`,
        existingBooking: booking
      };
    }
  }

  return { conflict: false };
}

async function addAuditLog(bookingId, action, fromStatus, toStatus, note) {
  await run(`
    INSERT INTO audit_logs (booking_id, action, from_status, to_status, note)
    VALUES (?, ?, ?, ?, ?)
  `, [bookingId, action, fromStatus, toStatus, note]);
}

async function createBooking(data) {
  await waitForInitialization();
  
  const {
    customer_name, phone, studio, booking_date,
    start_time, end_time, deposit_amount, note
  } = data;

  const conflict = await checkTimeConflict(studio, booking_date, start_time, end_time);
  if (conflict.conflict) {
    throw new Error(conflict.message);
  }

  const result = await run(`
    INSERT INTO bookings 
    (customer_name, phone, studio, booking_date, start_time, end_time, deposit_amount, status, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `, [customer_name, phone, studio, booking_date, start_time, end_time, deposit_amount, note]);

  await addAuditLog(
    result.lastID,
    'create',
    null,
    'pending',
    `创建预约 - 客户: ${customer_name}, 棚位: ${studio}, 日期: ${booking_date}, 时间: ${start_time}-${end_time}`
  );

  return result.lastID;
}

async function updateBooking(id, data) {
  await waitForInitialization();
  
  const existingBooking = await get(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existingBooking) {
    throw new Error('预约不存在');
  }

  if (existingBooking.status === 'verified' || existingBooking.status === 'refunded') {
    throw new Error('已核销或已退款的预约无法修改');
  }

  const {
    customer_name, phone, studio, booking_date,
    start_time, end_time, deposit_amount, note
  } = data;

  const conflict = await checkTimeConflict(studio, booking_date, start_time, end_time, id);
  if (conflict.conflict) {
    throw new Error(conflict.message);
  }

  await run(`
    UPDATE bookings SET
      customer_name = ?, phone = ?, studio = ?,
      booking_date = ?, start_time = ?, end_time = ?,
      deposit_amount = ?, note = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [customer_name, phone, studio, booking_date, start_time, end_time, deposit_amount, note, id]);

  await addAuditLog(
    id,
    'update',
    existingBooking.status,
    existingBooking.status,
    `更新预约信息`
  );

  return true;
}

async function updateStatus(id, newStatus, note = '') {
  await waitForInitialization();
  
  const existingBooking = await get(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existingBooking) {
    throw new Error('预约不存在');
  }

  const oldStatus = existingBooking.status;

  if (!canTransition(oldStatus, newStatus)) {
    const reason = getTransitionReason(oldStatus, newStatus);
    throw new Error(reason || '状态变更不允许');
  }

  await run(`
    UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStatus, id]);

  let action = '';
  let actionNote = note;

  if (newStatus === 'deposited') {
    action = 'deposit';
    actionNote = note || `收取押金 ¥${existingBooking.deposit_amount}`;
  } else if (newStatus === 'verified') {
    action = 'verify';
    actionNote = note || `核销预约，押金 ¥${existingBooking.deposit_amount} 已确认`;
  } else if (newStatus === 'refunded') {
    action = 'refund';
    actionNote = note || `退回押金 ¥${existingBooking.deposit_amount}`;
  }

  await addAuditLog(
    id,
    action,
    oldStatus,
    newStatus,
    actionNote
  );

  return true;
}

async function getBookingById(id) {
  await waitForInitialization();
  return await get(`SELECT * FROM bookings WHERE id = ?`, [id]);
}

async function getBookings(filters = {}) {
  await waitForInitialization();
  
  let sql = `SELECT * FROM bookings WHERE 1=1`;
  const params = [];

  if (filters.booking_date) {
    sql += ` AND booking_date = ?`;
    params.push(filters.booking_date);
  }

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }

  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    sql += ` AND (customer_name LIKE ? OR phone LIKE ? OR studio LIKE ?)`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  sql += ` ORDER BY booking_date DESC, start_time ASC`;

  return await all(sql, params);
}

async function getAuditLogs(bookingId) {
  await waitForInitialization();
  return await all(`
    SELECT * FROM audit_logs WHERE booking_id = ? ORDER BY created_at DESC
  `, [bookingId]);
}

function isOverdue(booking) {
  const today = new Date().toISOString().split('T')[0];
  return booking.booking_date < today && 
         (booking.status === 'pending' || booking.status === 'deposited');
}

async function init() {
  await waitForInitialization();
}

module.exports = {
  init,
  run,
  get,
  all,
  createBooking,
  updateBooking,
  updateStatus,
  getBookingById,
  getBookings,
  getAuditLogs,
  checkTimeConflict,
  addAuditLog,
  isTimeOverlap,
  isOverdue,
  getStatusName,
  canTransition,
  getAvailableTransitions,
  getTransitionReason,
  STATUS_FLOW,
  STATUS_NAMES
};
