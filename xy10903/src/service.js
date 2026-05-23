const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const IDENTITY_PRIORITY = {
  teacher: 2,
  staff: 1,
  student: 0
};

const PICKUP_WINDOW_HOURS = 24;

const logError = (apiPath, httpMethod, rawInput, errorMessage, processingResult) => {
  return new Promise((resolve) => {
    const stmt = db.prepare(`INSERT INTO error_logs 
      (id, api_path, http_method, raw_input, error_message, processing_result, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(uuidv4(), apiPath, httpMethod, JSON.stringify(rawInput), 
      errorMessage, JSON.stringify(processingResult), Date.now(), () => {
      resolve();
    });
    stmt.finalize();
  });
};

const getReaderById = (readerId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM readers WHERE id = ?', [readerId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getBookCopyById = (bookCopyId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM book_copies WHERE id = ?', [bookCopyId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getExistingBooking = (bookCopyId, readerId, idempotencyKey) => {
  return new Promise((resolve, reject) => {
    let query, params;
    if (idempotencyKey) {
      query = 'SELECT * FROM booking_queue WHERE request_idempotency_key = ?';
      params = [idempotencyKey];
    } else {
      query = `SELECT * FROM booking_queue 
        WHERE book_copy_id = ? AND reader_id = ? AND status IN ('pending', 'locked')`;
      params = [bookCopyId, readerId];
    }
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getBookQueue = (bookCopyId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM booking_queue 
      WHERE book_copy_id = ? AND status IN ('pending', 'locked')
      ORDER BY priority DESC, created_at ASC`, [bookCopyId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createBooking = async (bookCopyId, readerId, idempotencyKey = null) => {
  const reader = await getReaderById(readerId);
  if (!reader) {
    throw new Error('读者不存在');
  }

  const bookCopy = await getBookCopyById(bookCopyId);
  if (!bookCopy) {
    throw new Error('书籍副本不存在');
  }

  if (idempotencyKey) {
    const existing = await getExistingBooking(null, null, idempotencyKey);
    if (existing) {
      return { booking: existing, isDuplicate: true };
    }
  }

  const existingActive = await getExistingBooking(bookCopyId, readerId);
  if (existingActive) {
    return { booking: existingActive, isDuplicate: true };
  }

  const priority = IDENTITY_PRIORITY[reader.identity_type] || 0;
  const now = Date.now();
  const bookingId = uuidv4();

  const insertStmt = db.prepare(`INSERT INTO booking_queue 
    (id, book_copy_id, reader_id, priority, status, request_idempotency_key, 
     position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  await new Promise((resolve, reject) => {
    insertStmt.run(bookingId, bookCopyId, readerId, priority, 'pending', 
      idempotencyKey, 0, now, now, function(err) {
      if (err) reject(err);
      else resolve();
    });
    insertStmt.finalize();
  });

  const allBookings = await new Promise((resolve, reject) => {
    db.all(`SELECT id, priority, created_at FROM booking_queue 
      WHERE book_copy_id = ? AND status IN ('pending', 'locked')
      ORDER BY priority DESC, created_at ASC`, [bookCopyId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const updatePromises = allBookings.map((b, idx) => {
    return new Promise((resolve) => {
      db.run(`UPDATE booking_queue SET position = ?, updated_at = ? WHERE id = ?`, 
        [idx + 1, now, b.id], () => resolve());
    });
  });
  await Promise.all(updatePromises);

  const booking = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  return { booking, isDuplicate: false };
};

const lockNextBooking = async (bookCopyId) => {
  const queue = await getBookQueue(bookCopyId);
  if (queue.length === 0) {
    return null;
  }

  const nextBooking = queue.find(b => b.status === 'pending');
  if (!nextBooking) {
    return null;
  }

  const now = Date.now();
  const windowStart = now;
  const windowEnd = now + (PICKUP_WINDOW_HOURS * 60 * 60 * 1000);

  return new Promise((resolve, reject) => {
    db.run(`UPDATE booking_queue 
      SET status = 'locked', window_start = ?, window_end = ?, updated_at = ?
      WHERE id = ?`, [windowStart, windowEnd, now, nextBooking.id], (err) => {
      if (err) reject(err);
      else {
        db.run(`UPDATE book_copies SET status = 'reserved', updated_at = ? WHERE id = ?`, 
          [now, bookCopyId], (err) => {
          if (err) reject(err);
          else {
            db.get('SELECT * FROM booking_queue WHERE id = ?', [nextBooking.id], (err, booking) => {
              if (err) reject(err);
              else resolve(booking);
            });
          }
        });
      }
    });
  });
};

const fulfillBooking = async (bookingId) => {
  const now = Date.now();
  const booking = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!booking) {
    throw new Error('预约记录不存在');
  }

  if (booking.status !== 'locked') {
    throw new Error('只有锁定状态的预约才能完成取书');
  }

  return new Promise((resolve, reject) => {
    db.run(`UPDATE booking_queue SET status = 'fulfilled', updated_at = ? WHERE id = ?`, 
      [now, bookingId], (err) => {
      if (err) reject(err);
      else {
        db.run(`UPDATE book_copies SET status = 'borrowed', updated_at = ? WHERE id = ?`, 
          [now, booking.book_copy_id], (err) => {
          if (err) reject(err);
          else {
            db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          }
        });
      }
    });
  });
};

const checkAndReleaseOverdue = async () => {
  const now = Date.now();
  const expiredBookings = await new Promise((resolve, reject) => {
    db.all(`SELECT * FROM booking_queue 
      WHERE status = 'locked' AND window_end < ?`, [now], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const results = [];
  for (const booking of expiredBookings) {
    const overdueId = uuidv4();
    await new Promise((resolve, reject) => {
      const stmt = db.prepare(`INSERT INTO overdue_records 
        (id, booking_id, book_copy_id, reader_id, overdue_type, due_time, created_at)
        VALUES (?, ?, ?, ?, 'pickup', ?, ?)`);
      stmt.run(overdueId, booking.id, booking.book_copy_id, booking.reader_id, 
        booking.window_end, now, function(err) {
        if (err) reject(err);
        else resolve();
      });
      stmt.finalize();
    });

    await new Promise((resolve, reject) => {
      db.run(`UPDATE booking_queue SET status = 'expired', updated_at = ? WHERE id = ?`, 
        [now, booking.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const bookCopyId = booking.book_copy_id;
    await new Promise((resolve, reject) => {
      db.run(`UPDATE book_copies SET status = 'available', updated_at = ? WHERE id = ?`, 
        [now, bookCopyId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.all(`SELECT id FROM booking_queue 
        WHERE book_copy_id = ? AND status = 'pending'
        ORDER BY priority DESC, created_at ASC`, [bookCopyId], (err, rows) => {
        if (err) reject(err);
        else {
          const updates = rows.map((b, idx) => {
            return new Promise((res) => {
              db.run(`UPDATE booking_queue SET position = ?, updated_at = ? WHERE id = ?`, 
                [idx + 1, now, b.id], () => res());
            });
          });
          Promise.all(updates).then(resolve);
        }
      });
    });

    results.push({ bookingId: booking.id, overdueId });
  }

  return results;
};

const manualCorrection = async (bookingId, updates) => {
  const now = Date.now();
  const allowedFields = ['status', 'position', 'priority'];
  const setClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('没有有效的更新字段');
  }

  setClauses.push('updated_at = ?');
  params.push(now, bookingId);

  return new Promise((resolve, reject) => {
    db.run(`UPDATE booking_queue SET ${setClauses.join(', ')} WHERE id = ?`, params, (err) => {
      if (err) reject(err);
      else {
        db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      }
    });
  });
};

const generateCirculationReport = async (startTime, endTime, reportType = 'daily') => {
  const bookings = await new Promise((resolve, reject) => {
    db.all(`SELECT * FROM booking_queue 
      WHERE created_at >= ? AND created_at <= ?`, [startTime, endTime], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const overdue = await new Promise((resolve, reject) => {
    db.all(`SELECT * FROM overdue_records 
      WHERE created_at >= ? AND created_at <= ?`, [startTime, endTime], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const content = {
    totalBookings: bookings.length,
    fulfilled: bookings.filter(b => b.status === 'fulfilled').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    expired: bookings.filter(b => b.status === 'expired').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    overdueCount: overdue.length,
    bookings: bookings,
    overdueRecords: overdue
  };

  const reportId = uuidv4();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO circulation_reports 
      (id, report_type, start_time, end_time, content, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(reportId, reportType, startTime, endTime, JSON.stringify(content), now, function(err) {
      if (err) reject(err);
      else {
        db.get('SELECT * FROM circulation_reports WHERE id = ?', [reportId], (err, report) => {
          if (err) reject(err);
          else {
            report.content = JSON.parse(report.content);
            resolve(report);
          }
        });
      }
    });
    stmt.finalize();
  });
};

const cancelBooking = async (bookingId) => {
  const now = Date.now();
  const booking = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!booking) {
    throw new Error('预约记录不存在');
  }

  return new Promise((resolve, reject) => {
    db.run(`UPDATE booking_queue SET status = 'cancelled', updated_at = ? WHERE id = ?`, 
      [now, bookingId], (err) => {
      if (err) reject(err);
      else {
        db.get('SELECT * FROM booking_queue WHERE id = ?', [bookingId], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      }
    });
  });
};

module.exports = {
  logError,
  getReaderById,
  getBookCopyById,
  createBooking,
  lockNextBooking,
  fulfillBooking,
  cancelBooking,
  checkAndReleaseOverdue,
  manualCorrection,
  generateCirculationReport,
  getBookQueue
};
