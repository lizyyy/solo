const express = require('express');
const router = express.Router();
const db = require('../config/database');
const reservationService = require('../services/reservationService');
const { Parser } = require('json2csv');

router.post('/reservations', async (req, res, next) => {
  try {
    const { workorderId, engineerId, parts } = req.body;
    
    if (!workorderId || !engineerId || !parts || !Array.isArray(parts)) {
      const error = new Error('参数不完整：workorderId, engineerId, parts 为必填');
      error.statusCode = 400;
      throw error;
    }

    const result = await reservationService.reserveParts(workorderId, engineerId, parts);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/reservations', (req, res, next) => {
  try {
    const { workorderId, status } = req.query;
    let query = `
      SELECT r.*, w.workorder_no, e.name as engineer_name, p.part_name, p.part_code
      FROM reservation_records r
      LEFT JOIN repair_workorders w ON r.workorder_id = w.id
      LEFT JOIN engineers e ON r.engineer_id = e.id
      LEFT JOIN spare_parts p ON r.part_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (workorderId) {
      query += ' AND r.workorder_id = ?';
      params.push(workorderId);
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    db.all(query, params, (err, rows) => {
      if (err) return next(err);
      res.json({ success: true, data: rows });
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reservations/:id', (req, res, next) => {
  db.get(
    `SELECT r.*, w.workorder_no, e.name as engineer_name, p.part_name, p.part_code
     FROM reservation_records r
     LEFT JOIN repair_workorders w ON r.workorder_id = w.id
     LEFT JOIN engineers e ON r.engineer_id = e.id
     LEFT JOIN spare_parts p ON r.part_id = p.id
     WHERE r.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return next(err);
      if (!row) {
        return res.status(404).json({ success: false, message: '预占记录不存在' });
      }
      res.json({ success: true, data: row });
    }
  );
});

router.put('/reservations/:id/correct', async (req, res, next) => {
  try {
    const result = await reservationService.manualCorrection(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/reservations/release-expired', async (req, res, next) => {
  try {
    const result = await reservationService.releaseExpiredReservations();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/workorders', (req, res, next) => {
  const { workorderNo, customerName, customerPhone, address, productModel, faultDescription } = req.body;
  
  if (!workorderNo || !customerName) {
    const error = new Error('参数不完整：workorderNo, customerName 为必填');
    error.statusCode = 400;
    return next(error);
  }

  db.run(
    `INSERT INTO repair_workorders 
     (workorder_no, customer_name, customer_phone, address, product_model, fault_description) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workorderNo, customerName, customerPhone || null, address || null, productModel || null, faultDescription || null],
    function(err) {
      if (err) return next(err);
      res.json({ success: true, message: '工单创建成功', id: this.lastID });
    }
  );
});

router.get('/workorders', (req, res, next) => {
  const { status, engineerId } = req.query;
  let query = 'SELECT * FROM repair_workorders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (engineerId) {
    query += ' AND engineer_id = ?';
    params.push(engineerId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/workorders/:id', (req, res, next) => {
  db.get('SELECT * FROM repair_workorders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return next(err);
    if (!row) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.put('/workorders/:id/reassign', async (req, res, next) => {
  try {
    const { newEngineerId } = req.body;
    if (!newEngineerId) {
      const error = new Error('newEngineerId 为必填');
      error.statusCode = 400;
      throw error;
    }

    const result = await reservationService.reassignWorkorder(req.params.id, newEngineerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/workorders/:id/fulfill', async (req, res, next) => {
  try {
    const result = await reservationService.fulfillWorkorder(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/spare-parts', (req, res, next) => {
  const { category, lowStock } = req.query;
  let query = 'SELECT *, (SELECT COALESCE(SUM(quantity), 0) FROM reservation_records WHERE part_id = spare_parts.id AND status = "已预占") as reserved_quantity FROM spare_parts WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (lowStock === 'true') {
    query += ' AND quantity <= min_stock';
  }

  db.all(query, params, (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/engineers', (req, res, next) => {
  db.all('SELECT * FROM engineers', [], (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/engineers/:id/schedule', (req, res, next) => {
  const { date } = req.query;
  let query = 'SELECT * FROM engineer_schedules WHERE engineer_id = ?';
  const params = [req.params.id];

  if (date) {
    query += ' AND work_date = ?';
    params.push(date);
  }

  db.all(query, params, (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/fulfillment-summaries', (req, res, next) => {
  const { workorderId } = req.query;
  let query = `
    SELECT f.*, w.workorder_no, e.name as engineer_name
    FROM fulfillment_summaries f
    LEFT JOIN repair_workorders w ON f.workorder_id = w.id
    LEFT JOIN engineers e ON f.engineer_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (workorderId) {
    query += ' AND f.workorder_id = ?';
    params.push(workorderId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/exception-logs', (req, res, next) => {
  db.all('SELECT * FROM exception_logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return next(err);
    res.json({ success: true, data: rows });
  });
});

router.get('/export/reservations', (req, res, next) => {
  db.all(
    `SELECT r.id, w.workorder_no, e.name as engineer_name, p.part_code, p.part_name, 
            r.quantity, r.status, r.reserved_at, r.expired_at, r.released_at
     FROM reservation_records r
     LEFT JOIN repair_workorders w ON r.workorder_id = w.id
     LEFT JOIN engineers e ON r.engineer_id = e.id
     LEFT JOIN spare_parts p ON r.part_id = p.id
     ORDER BY r.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return next(err);
      
      try {
        const parser = new Parser();
        const csv = parser.parse(rows);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
        res.send('\uFEFF' + csv);
      } catch (parseErr) {
        next(parseErr);
      }
    }
  );
});

module.exports = router;