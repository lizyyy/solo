const express = require('express');
const router = express.Router();
const db = require('./database');
const service = require('./service');
const { Parser } = require('json2csv');

router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(async (err) => {
    await service.logError(req.path, req.method, req.body, err.message, { handled: true, status: 400 });
    res.status(400).json({ error: err.message, success: false });
  });
};

router.post('/bookings', asyncHandler(async (req, res) => {
  const { book_copy_id, reader_id, idempotency_key } = req.body;
  
  if (!book_copy_id || !reader_id) {
    throw new Error('缺少必要参数: book_copy_id 和 reader_id');
  }

  const result = await service.createBooking(book_copy_id, reader_id, idempotency_key);
  res.status(201).json({
    success: true,
    data: result.booking,
    is_duplicate: result.isDuplicate
  });
}));

router.get('/bookings', asyncHandler(async (req, res) => {
  const { book_copy_id, reader_id, status } = req.query;
  let query = 'SELECT * FROM booking_queue WHERE 1=1';
  const params = [];

  if (book_copy_id) {
    query += ' AND book_copy_id = ?';
    params.push(book_copy_id);
  }
  if (reader_id) {
    query += ' AND reader_id = ?';
    params.push(reader_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const bookings = await new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  res.json({ success: true, data: bookings });
}));

router.get('/bookings/:id', asyncHandler(async (req, res) => {
  const booking = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM booking_queue WHERE id = ?', [req.params.id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!booking) {
    return res.status(404).json({ success: false, error: '预约记录不存在' });
  }

  res.json({ success: true, data: booking });
}));

router.post('/bookings/lock-next', asyncHandler(async (req, res) => {
  const { book_copy_id } = req.body;
  if (!book_copy_id) {
    throw new Error('缺少必要参数: book_copy_id');
  }

  const result = await service.lockNextBooking(book_copy_id);
  if (!result) {
    return res.json({ success: true, data: null, message: '没有待锁定的预约' });
  }

  res.json({ success: true, data: result });
}));

router.post('/bookings/:id/fulfill', asyncHandler(async (req, res) => {
  const result = await service.fulfillBooking(req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/bookings/:id/cancel', asyncHandler(async (req, res) => {
  const result = await service.cancelBooking(req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/overdue/check', asyncHandler(async (req, res) => {
  const results = await service.checkAndReleaseOverdue();
  res.json({ success: true, data: results, count: results.length });
}));

router.patch('/bookings/:id/manual', asyncHandler(async (req, res) => {
  const result = await service.manualCorrection(req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.get('/reports/circulation', asyncHandler(async (req, res) => {
  const { start_time, end_time, type = 'daily' } = req.query;
  
  const now = Date.now();
  const defaultStart = now - 24 * 60 * 60 * 1000;
  
  const startTime = parseInt(start_time) || defaultStart;
  const endTime = parseInt(end_time) || now;

  const report = await service.generateCirculationReport(startTime, endTime, type);
  res.json({ success: true, data: report });
}));

router.get('/export/circulation', asyncHandler(async (req, res) => {
  const { start_time, end_time, format = 'csv' } = req.query;
  
  const now = Date.now();
  const defaultStart = now - 24 * 60 * 60 * 1000;
  
  const startTime = parseInt(start_time) || defaultStart;
  const endTime = parseInt(end_time) || now;

  const report = await service.generateCirculationReport(startTime, endTime, 'export');
  
  if (format === 'csv') {
    const fields = ['id', 'book_copy_id', 'reader_id', 'status', 'priority', 'position', 'created_at'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(report.content.bookings || []);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=circulation.csv');
    res.send(csv);
  } else {
    res.json({ success: true, data: report.content });
  }
}));

router.get('/readers', asyncHandler(async (req, res) => {
  const readers = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM readers ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  res.json({ success: true, data: readers });
}));

router.get('/readers/:id', asyncHandler(async (req, res) => {
  const reader = await service.getReaderById(req.params.id);
  if (!reader) {
    return res.status(404).json({ success: false, error: '读者不存在' });
  }
  res.json({ success: true, data: reader });
}));

router.get('/books', asyncHandler(async (req, res) => {
  const books = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM book_copies ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  res.json({ success: true, data: books });
}));

router.get('/books/:id', asyncHandler(async (req, res) => {
  const book = await service.getBookCopyById(req.params.id);
  if (!book) {
    return res.status(404).json({ success: false, error: '书籍不存在' });
  }
  res.json({ success: true, data: book });
}));

router.get('/books/:id/queue', asyncHandler(async (req, res) => {
  const queue = await service.getBookQueue(req.params.id);
  res.json({ success: true, data: queue });
}));

router.get('/error-logs', asyncHandler(async (req, res) => {
  const logs = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM error_logs ORDER BY occurred_at DESC LIMIT 100', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  res.json({ success: true, data: logs });
}));

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: Date.now() });
});

module.exports = router;
