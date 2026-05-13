const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const rulesEngine = require('./rulesEngine');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/batches', async (req, res) => {
  try {
    const { orchard_name, fruit_type, status } = req.query;
    let sql = `SELECT * FROM orchard_batches WHERE 1=1`;
    let params = [];
    
    if (orchard_name) { sql += ` AND orchard_name LIKE ?`; params.push(`%${orchard_name}%`); }
    if (fruit_type) { sql += ` AND fruit_type = ?`; params.push(fruit_type); }
    if (status) { sql += ` AND status = ?`; params.push(status); }
    
    sql += ` ORDER BY created_at DESC`;
    const batches = await db.all(sql, params);
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const id = uuidv4();
    const { orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield, unit } = req.body;
    await db.run(
      `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield || estimated_yield, unit || 'kg']
    );
    await rulesEngine.addTimeline('batch', id, 'created', `创建批次: ${batch_code}`);
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const { batch_id, status, customer_name } = req.query;
    let sql = `SELECT a.*, b.orchard_name, b.fruit_type, b.batch_code 
               FROM appointments a 
               LEFT JOIN orchard_batches b ON a.batch_id = b.id 
               WHERE 1=1`;
    let params = [];
    
    if (batch_id) { sql += ` AND a.batch_id = ?`; params.push(batch_id); }
    if (status) { sql += ` AND a.status = ?`; params.push(status); }
    if (customer_name) { sql += ` AND a.customer_name LIKE ?`; params.push(`%${customer_name}%`); }
    
    sql += ` ORDER BY a.created_at DESC`;
    const appointments = await db.all(sql, params);
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const id = uuidv4();
    const { batch_id, customer_name, customer_phone, quantity, appointment_date, time_slot } = req.body;
    
    const yieldCheck = await rulesEngine.checkYieldLimit(batch_id, quantity);
    if (!yieldCheck.valid) {
      return res.status(400).json({ error: yieldCheck.reason, details: yieldCheck.details });
    }
    
    await db.run(
      `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date, time_slot) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, batch_id, customer_name, customer_phone, quantity, appointment_date, time_slot]
    );
    await rulesEngine.addTimeline('appointment', id, 'created', `创建预约: ${customer_name}`);
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reschedules', async (req, res) => {
  try {
    const { status, appointment_id } = req.query;
    let sql = `SELECT r.*, a.customer_name, a.customer_phone, b.batch_code
               FROM reschedule_records r
               LEFT JOIN appointments a ON r.appointment_id = a.id
               LEFT JOIN orchard_batches b ON a.batch_id = b.id
               WHERE 1=1`;
    let params = [];
    
    if (status) { sql += ` AND r.status = ?`; params.push(status); }
    if (appointment_id) { sql += ` AND r.appointment_id = ?`; params.push(appointment_id); }
    
    sql += ` ORDER BY r.created_at DESC`;
    const records = await db.all(sql, params);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reschedules', async (req, res) => {
  try {
    const result = await rulesEngine.processReschedule(req.body, req.body.operator || 'system');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reschedules/:id/review', async (req, res) => {
  try {
    const { approved, reviewed_by, notes } = req.body;
    const result = await rulesEngine.reviewReschedule(req.params.id, approved, reviewed_by, notes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/manual-correction', async (req, res) => {
  try {
    const { entity_type, entity_id, corrections, operator } = req.body;
    const result = await rulesEngine.manualCorrection(entity_type, entity_id, corrections, operator);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/yield-limits', async (req, res) => {
  try {
    const limits = await db.all(`
      SELECT yl.*, b.orchard_name, b.fruit_type, b.batch_code
      FROM yield_limits yl
      LEFT JOIN orchard_batches b ON yl.batch_id = b.id
      ORDER BY yl.created_at DESC
    `);
    res.json(limits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/weather-delays', async (req, res) => {
  try {
    const delays = await db.all(`
      SELECT wd.*, b.orchard_name, b.fruit_type, b.batch_code
      FROM weather_delays wd
      LEFT JOIN orchard_batches b ON wd.batch_id = b.id
      ORDER BY wd.created_at DESC
    `);
    res.json(delays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/weather-delays', async (req, res) => {
  try {
    const id = uuidv4();
    const { batch_id, delay_reason, original_date, new_date, weather_type, impact_level } = req.body;
    await db.run(
      `INSERT INTO weather_delays (id, batch_id, delay_reason, original_date, new_date, weather_type, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, batch_id, delay_reason, original_date, new_date, weather_type, impact_level || 'medium']
    );
    await rulesEngine.addTimeline('weather_delay', id, 'created', `创建天气延期: ${delay_reason}`);
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/refund-rules', async (req, res) => {
  try {
    const rules = await db.all(`SELECT * FROM refund_rules WHERE is_active = 1 ORDER BY days_before_appointment DESC`);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { entity_type, entity_id, limit = 100 } = req.query;
    let sql = `SELECT * FROM timeline WHERE 1=1`;
    let params = [];
    
    if (entity_type) { sql += ` AND entity_type = ?`; params.push(entity_type); }
    if (entity_id) { sql += ` AND entity_id = ?`; params.push(entity_id); }
    
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const timeline = await db.all(sql, params);
    res.json(timeline.map(t => ({ ...t, metadata: t.metadata ? JSON.parse(t.metadata) : null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const { unread_only } = req.query;
    let sql = `SELECT * FROM notifications WHERE 1=1`;
    let params = [];
    
    if (unread_only === 'true') {
      sql += ` AND read_at IS NULL`;
    }
    
    sql += ` ORDER BY created_at DESC`;
    const notifications = await db.all(sql, params);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/appointments/import', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const stream = Readable.from(req.file.buffer);
    
    stream.pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const imported = [];
        for (const row of results) {
          const id = uuidv4();
          await db.run(
            `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date, time_slot) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, row.batch_id, row.customer_name, row.customer_phone, parseFloat(row.quantity), row.appointment_date, row.time_slot]
          );
          imported.push({ id, ...row });
        }
        res.json({ imported: imported.length, data: imported });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/appointments/export', async (req, res) => {
  try {
    const appointments = await db.all(`
      SELECT a.*, b.orchard_name, b.fruit_type, b.batch_code
      FROM appointments a
      LEFT JOIN orchard_batches b ON a.batch_id = b.id
      ORDER BY a.created_at DESC
    `);
    
    const parser = new Parser();
    const csv = parser.parse(appointments);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=appointments.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/demo/success', async (req, res) => {
  try {
    const batchId = uuidv4();
    await db.run(
      `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, '成功果园', '草莓', 'BATCH-SUCCESS-001', '2026-06-01', 500, 500]
    );
    
    const appointmentId = uuidv4();
    await db.run(
      `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [appointmentId, batchId, '张三', '13800138000', 10, '2026-06-01']
    );
    
    const result = await rulesEngine.processReschedule({
      appointmentId,
      newDate: '2026-06-05',
      reason: '个人行程调整',
      operator: 'demo'
    });
    
    await rulesEngine.reviewReschedule(result.recordId, true, 'admin', '同意改期');
    
    res.json({ message: '成功路径演示完成', batchId, appointmentId, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/demo/blocked', async (req, res) => {
  try {
    const batchId = uuidv4();
    await db.run(
      `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, '拦截果园', '樱桃', 'BATCH-BLOCKED-001', '2026-06-01', 50, 50]
    );
    
    const appointmentId = uuidv4();
    await db.run(
      `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [appointmentId, batchId, '李四', '13900139000', 60, '2026-06-01']
    );
    
    const result = await rulesEngine.processReschedule({
      appointmentId,
      newDate: '2026-06-10',
      reason: '想多采摘一些',
      operator: 'demo'
    });
    
    res.json({ message: '拦截路径演示完成', batchId, appointmentId, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/demo/manual', async (req, res) => {
  try {
    const batchId = uuidv4();
    await db.run(
      `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, '修正果园', '蓝莓', 'BATCH-MANUAL-001', '2026-06-01', 200, 200]
    );
    
    const appointmentId = uuidv4();
    await db.run(
      `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [appointmentId, batchId, '王五', '13700137000', 15, '2026-06-01', 'cancelled']
    );
    
    const result = await rulesEngine.manualCorrection('appointment', appointmentId, {
      quantity: 25,
      appointment_date: '2026-06-15',
      status: 'confirmed'
    }, 'operator_zhang');
    
    res.json({ message: '人工修正路径演示完成', batchId, appointmentId, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/demo/duplicate', async (req, res) => {
  try {
    const batchId = uuidv4();
    await db.run(
      `INSERT INTO orchard_batches (id, orchard_name, fruit_type, batch_code, planned_date, estimated_yield, remaining_yield) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchId, '幂等果园', '葡萄', 'BATCH-DUPLICATE-001', '2026-06-01', 300, 300]
    );
    
    const appointmentId = uuidv4();
    await db.run(
      `INSERT INTO appointments (id, batch_id, customer_name, customer_phone, quantity, appointment_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [appointmentId, batchId, '赵六', '13600136000', 20, '2026-06-01']
    );
    
    const idempotencyKey = 'DEMO-KEY-' + Date.now();
    const result1 = await rulesEngine.processReschedule({
      appointmentId,
      newDate: '2026-06-20',
      reason: '网络重试',
      idempotencyKey,
      operator: 'demo'
    });
    
    const result2 = await rulesEngine.processReschedule({
      appointmentId,
      newDate: '2026-06-20',
      reason: '网络重试',
      idempotencyKey,
      operator: 'demo'
    });
    
    res.json({ 
      message: '重复提交路径演示完成', 
      batchId, 
      appointmentId, 
      firstRequest: result1,
      secondRequest: result2
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
