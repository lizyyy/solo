const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'books.db');
const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initDB = async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      isbn TEXT,
      title TEXT,
      author TEXT,
      publisher TEXT,
      publish_year TEXT,
      image_path TEXT,
      damage_note TEXT,
      appointment_id INTEGER,
      ai_category TEXT DEFAULT 'pending',
      ai_reason TEXT,
      ai_confidence REAL DEFAULT 0,
      final_category TEXT,
      manual_reason TEXT,
      is_reviewed INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      isbn TEXT,
      title TEXT,
      requester_name TEXT,
      contact_info TEXT,
      appointment_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS risk_reasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      reason_type TEXT,
      reason_detail TEXT,
      confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      action TEXT,
      old_category TEXT,
      new_category TEXT,
      old_reason TEXT,
      new_reason TEXT,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  await dbRun(`CREATE INDEX IF NOT EXISTS idx_books_batch ON books(batch_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_books_category ON books(ai_category)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_appointments_isbn ON appointments(isbn)`);
};

const createBatch = async (batchNumber, description = '') => {
  const result = await dbRun(
    'INSERT INTO batches (batch_number, description) VALUES (?, ?)',
    [batchNumber, description]
  );
  return result.lastID;
};

const getBatchByNumber = async (batchNumber) => {
  return dbGet('SELECT * FROM batches WHERE batch_number = ?', [batchNumber]);
};

const getBatches = async () => {
  return dbAll(`
    SELECT b.*, 
           COUNT(DISTINCT bo.id) as total_books,
           COUNT(DISTINCT a.id) as total_appointments
    FROM batches b
    LEFT JOIN books bo ON b.id = bo.batch_id
    LEFT JOIN appointments a ON b.id = a.batch_id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
};

const createBook = async (bookData) => {
  const result = await dbRun(`
    INSERT INTO books (batch_id, isbn, title, author, publisher, publish_year, image_path, damage_note, appointment_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    bookData.batch_id,
    bookData.isbn,
    bookData.title,
    bookData.author,
    bookData.publisher,
    bookData.publish_year,
    bookData.image_path,
    bookData.damage_note,
    bookData.appointment_id,
    bookData.notes
  ]);
  return result.lastID;
};

const updateBook = async (bookId, updates) => {
  const fields = Object.keys(updates).map(key => `${key} = ?`);
  const values = Object.values(updates);
  values.push(new Date().toISOString());
  values.push(bookId);
  
  await dbRun(`
    UPDATE books SET ${fields.join(', ')}, updated_at = ? WHERE id = ?
  `, values);
};

const getBooksByBatch = async (batchId, filters = {}) => {
  let sql = `
    SELECT bo.*, 
           a.requester_name, a.contact_info, a.appointment_date as appointment_info,
           GROUP_CONCAT(DISTINCT rr.reason_type || ': ' || rr.reason_detail, '; ') as risk_details
    FROM books bo
    LEFT JOIN appointments a ON bo.appointment_id = a.id
    LEFT JOIN risk_reasons rr ON bo.id = rr.book_id
    WHERE bo.batch_id = ?
  `;
  
  const params = [batchId];
  
  if (filters.category) {
    sql += ' AND (bo.ai_category = ? OR bo.final_category = ?)';
    params.push(filters.category, filters.category);
  }
  
  if (filters.reviewed !== undefined) {
    sql += ' AND bo.is_reviewed = ?';
    params.push(filters.reviewed ? 1 : 0);
  }
  
  sql += ' GROUP BY bo.id ORDER BY bo.created_at';
  
  return dbAll(sql, params);
};

const getBookById = async (bookId) => {
  return dbGet(`
    SELECT bo.*, 
           a.requester_name, a.contact_info, a.appointment_date as appointment_info
    FROM books bo
    LEFT JOIN appointments a ON bo.appointment_id = a.id
    WHERE bo.id = ?
  `, [bookId]);
};

const createAppointment = async (appointmentData) => {
  const result = await dbRun(`
    INSERT INTO appointments (batch_id, isbn, title, requester_name, contact_info, appointment_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    appointmentData.batch_id,
    appointmentData.isbn,
    appointmentData.title,
    appointmentData.requester_name,
    appointmentData.contact_info,
    appointmentData.appointment_date,
    appointmentData.notes
  ]);
  return result.lastID;
};

const getAppointmentsByBatch = async (batchId) => {
  return dbAll('SELECT * FROM appointments WHERE batch_id = ? ORDER BY created_at', [batchId]);
};

const getAppointmentByISBN = async (isbn, batchId = null) => {
  if (batchId) {
    return dbGet('SELECT * FROM appointments WHERE isbn = ? AND batch_id = ?', [isbn, batchId]);
  }
  return dbGet('SELECT * FROM appointments WHERE isbn = ?', [isbn]);
};

const addRiskReason = async (bookId, reasonType, reasonDetail, confidence = 0.5) => {
  await dbRun(`
    INSERT INTO risk_reasons (book_id, reason_type, reason_detail, confidence)
    VALUES (?, ?, ?, ?)
  `, [bookId, reasonType, reasonDetail, confidence]);
};

const getRiskReasonsByBook = async (bookId) => {
  return dbAll('SELECT * FROM risk_reasons WHERE book_id = ? ORDER BY confidence DESC', [bookId]);
};

const addAuditLog = async (logData) => {
  await dbRun(`
    INSERT INTO audit_logs (book_id, action, old_category, new_category, old_reason, new_reason, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    logData.book_id,
    logData.action,
    logData.old_category,
    logData.new_category,
    logData.old_reason,
    logData.new_reason,
    logData.operator || 'system'
  ]);
};

const getAuditLogsByBook = async (bookId) => {
  return dbAll('SELECT * FROM audit_logs WHERE book_id = ? ORDER BY created_at DESC', [bookId]);
};

const getAuditLogsByBatch = async (batchId) => {
  return dbAll(`
    SELECT al.*, bo.isbn, bo.title
    FROM audit_logs al
    JOIN books bo ON al.book_id = bo.id
    WHERE bo.batch_id = ?
    ORDER BY al.created_at DESC
  `, [batchId]);
};

module.exports = {
  initDB,
  createBatch,
  getBatchByNumber,
  getBatches,
  createBook,
  updateBook,
  getBooksByBatch,
  getBookById,
  createAppointment,
  getAppointmentsByBatch,
  getAppointmentByISBN,
  addRiskReason,
  getRiskReasonsByBook,
  addAuditLog,
  getAuditLogsByBook,
  getAuditLogsByBatch
};
