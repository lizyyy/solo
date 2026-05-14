const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const services = require('./services');
const stateMachine = require('./stateMachine');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

const IDEMPOTENCY_TTL = 5 * 60 * 1000;
const idempotencyCache = new Map();

function checkIdempotency(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();
  
  const cached = idempotencyCache.get(key);
  if (cached) {
    if (Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
      return res.json(cached.response);
    }
    idempotencyCache.delete(key);
  }
  next();
}

function cacheIdempotentResponse(key, response) {
  if (key) {
    idempotencyCache.set(key, { response, timestamp: Date.now() });
  }
}

router.post('/invoices/upload', checkIdempotency, upload.single('file'), async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    const existing = await db.get('SELECT id FROM invoices WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing) {
      const detail = await services.getInvoiceDetail(existing.id);
      return res.json({ id: existing.id, ...detail, cached: true });
    }

    const invoiceId = uuidv4();
    const imagePath = `/uploads/${req.file.filename}`;

    await db.run(
      'INSERT INTO invoices (id, image_path, idempotency_key, status) VALUES (?, ?, ?, ?)',
      [invoiceId, imagePath, idempotencyKey || null, 'uploaded']
    );

    const ocrResult = await services.simulateOCR(invoiceId);
    
    if (ocrResult.success) {
      await services.processTaxValidation(invoiceId);
    }

    const detail = await services.getInvoiceDetail(invoiceId);
    cacheIdempotentResponse(idempotencyKey, { id: invoiceId, ...detail });
    
    res.json({ id: invoiceId, ...detail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM invoices';
    let countQuery = 'SELECT COUNT(*) as total FROM invoices';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      countQuery += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const invoices = await db.all(query, params);
    const { total } = await db.get(countQuery, status ? [status] : []);
    
    res.json({ data: invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const detail = await services.getInvoiceDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: '发票不存在' });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/:id/retry', async (req, res) => {
  try {
    const result = await services.retryOCR(req.params.id);
    
    if (result.success) {
      await services.processTaxValidation(req.params.id);
    }
    
    const detail = await services.getInvoiceDetail(req.params.id);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/invoices/:id/review', async (req, res) => {
  try {
    const { action, operator, reason, updatedFields } = req.body;
    await services.reviewInvoice(req.params.id, action, operator, reason, updatedFields);
    const detail = await services.getInvoiceDetail(req.params.id);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/invoices/:id/resolve-duplicate', async (req, res) => {
  try {
    const { keepOriginal, operator, reason } = req.body;
    await services.resolveDuplicate(req.params.id, keepOriginal, operator, reason);
    const detail = await services.getInvoiceDetail(req.params.id);
    res.json(detail);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await services.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { createdBy = 'system' } = req.body;
    const result = await services.exportInvoices(createdBy);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/exports', async (req, res) => {
  try {
    const exports = await db.all('SELECT * FROM exports ORDER BY created_at DESC LIMIT 50');
    res.json(exports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await db.all(`
      SELECT a.*, i.invoice_number, i.amount
      FROM audit_logs a
      LEFT JOIN invoices i ON a.invoice_id = i.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices/:id/recalculate', async (req, res) => {
  try {
    const result = await services.processTaxValidation(req.params.id);
    const detail = await services.getInvoiceDetail(req.params.id);
    res.json({ ...detail, validation: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
