const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

const batchService = require('./batchService');
const queryService = require('./queryService');
const dataParser = require('./dataParser');

router.post('/batches', (req, res) => {
  const { batch_no, subsidy_month, operator, remark } = req.body;
  if (!batch_no || !subsidy_month || !operator) {
    return res.status(400).json({ error: '缺少必填字段: batch_no, subsidy_month, operator' });
  }
  try {
    const batchId = batchService.createBatch(batch_no, subsidy_month, operator, remark);
    res.status(201).json({ id: batchId, batch_no, subsidy_month, status: 'pending' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/batches', (req, res) => {
  const { status, subsidy_month } = req.query;
  let sql = 'SELECT * FROM batches';
  const params = {};
  const conditions = [];
  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }
  if (subsidy_month) {
    conditions.push('subsidy_month = @subsidy_month');
    params.subsidy_month = subsidy_month;
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const rows = require('./db').db.prepare(sql).all(params);
  res.json({ total: rows.length, batches: rows });
});

router.get('/batches/:id', (req, res) => {
  const batch = batchService.getBatchById(req.params.id);
  if (!batch) return res.status(404).json({ error: '批次不存在' });

  const summary = queryService.queryBatchSummary(req.params.id);
  res.json(summary);
});

router.post('/batches/:id/import-cards', upload.single('file'), (req, res) => {
  const batchId = req.params.id;
  const operator = req.body.operator || 'system';

  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  try {
    const rawRecords = dataParser.parseCardCSV(req.file.path);
    const normalized = rawRecords.map(dataParser.normalizeCardRecord);
    const result = batchService.importCardRecords(batchId, normalized, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    if (req.file) fs.unlinkSync(req.file.path);
  }
});

router.post('/batches/:id/import-subsidy', upload.single('file'), (req, res) => {
  const batchId = req.params.id;
  const operator = req.body.operator || 'system';

  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  try {
    const rawRecords = dataParser.parseSubsidyJSON(req.file.path);
    const normalized = rawRecords.map(dataParser.normalizeSubsidyRecord);
    const result = batchService.importSubsidyList(batchId, normalized, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    if (req.file) fs.unlinkSync(req.file.path);
  }
});

router.post('/batches/:id/import-refunds', upload.single('file'), (req, res) => {
  const batchId = req.params.id;
  const operator = req.body.operator || 'system';

  if (!req.file) return res.status(400).json({ error: '未上传文件' });

  try {
    const rawRecords = dataParser.parseRefundCSV(req.file.path);
    const normalized = rawRecords.map(dataParser.normalizeRefundRecord);
    const result = batchService.importRefundRecords(batchId, normalized, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    if (req.file) fs.unlinkSync(req.file.path);
  }
});

router.post('/card-records/:id/process', (req, res) => {
  const { action, operator, reason, final_amount } = req.body;
  if (!action || !operator) {
    return res.status(400).json({ error: '缺少必填字段: action, operator' });
  }
  const result = batchService.processCardRecord(req.params.id, operator, action, reason, final_amount);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/card-records/:id/batch-process', (req, res) => {
  const { action, operator, reason, ids } = req.body;
  if (!action || !operator || !Array.isArray(ids)) {
    return res.status(400).json({ error: '缺少必填字段: action, operator, ids(数组)' });
  }
  const results = [];
  for (const id of ids) {
    results.push(batchService.processCardRecord(id, operator, action, reason));
  }
  res.json({ total: results.length, results });
});

router.post('/refund-records/:id/process', (req, res) => {
  const { action, operator, reason } = req.body;
  if (!action || !operator) {
    return res.status(400).json({ error: '缺少必填字段: action, operator' });
  }
  const result = batchService.processRefundRecord(req.params.id, operator, action, reason);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/batches/:id/finalize', (req, res) => {
  const { operator } = req.body;
  if (!operator) return res.status(400).json({ error: '缺少 operator' });
  const result = batchService.finalizeBatch(req.params.id, operator);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/history', (req, res) => {
  const filters = {};
  if (req.query.student_id) filters.student_id = req.query.student_id;
  if (req.query.subsidy_month) filters.subsidy_month = req.query.subsidy_month;
  if (req.query.meal_type) filters.meal_type = req.query.meal_type;
  if (req.query.meal_date) filters.meal_date = req.query.meal_date;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.batch_id) filters.batch_id = req.query.batch_id;
  if (req.query.date_from) filters.date_from = req.query.date_from;
  if (req.query.date_to) filters.date_to = req.query.date_to;

  const result = queryService.queryHistory(filters);
  res.json(result);
});

router.get('/history/export', (req, res) => {
  const filters = {};
  if (req.query.student_id) filters.student_id = req.query.student_id;
  if (req.query.subsidy_month) filters.subsidy_month = req.query.subsidy_month;
  if (req.query.meal_type) filters.meal_type = req.query.meal_type;
  if (req.query.meal_date) filters.meal_date = req.query.meal_date;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.batch_id) filters.batch_id = req.query.batch_id;
  if (req.query.date_from) filters.date_from = req.query.date_from;
  if (req.query.date_to) filters.date_to = req.query.date_to;

  const result = queryService.exportHistory(filters);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `export_${timestamp}.csv`;
  const filepath = path.join(__dirname, '..', 'exports', filename);

  fs.mkdirSync(path.join(__dirname, '..', 'exports'), { recursive: true });
  fs.writeFileSync(filepath, result.csv);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(result.csv);
});

router.get('/card-records', (req, res) => {
  const filters = {};
  if (req.query.batch_id) filters.batch_id = req.query.batch_id;
  if (req.query.student_id) filters.student_id = req.query.student_id;
  if (req.query.check_result) filters.check_result = req.query.check_result;
  if (req.query.meal_date) filters.meal_date = req.query.meal_date;

  const result = queryService.queryCardRecords(filters);
  res.json(result);
});

router.get('/operation-logs', (req, res) => {
  const filters = {};
  if (req.query.batch_id) filters.batch_id = req.query.batch_id;
  if (req.query.card_record_id) filters.card_record_id = req.query.card_record_id;
  if (req.query.student_id) filters.student_id = req.query.student_id;

  const result = queryService.queryOperationLogs(filters);
  res.json(result);
});

router.get('/students/:student_id', (req, res) => {
  const detail = queryService.getStudentDetail(req.params.student_id);
  if (!detail.subsidy && detail.history.length === 0 && detail.cards.length === 0) {
    return res.status(404).json({ error: '未找到该学生记录' });
  }
  res.json(detail);
});

router.post('/validate-card', (req, res) => {
  const { student_id, meal_date, meal_type, amount, subsidy_month } = req.body;

  if (!student_id || !meal_date || !amount) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const issues = [];

  const dup = dataParser.detectDuplicate(student_id, meal_date, meal_type || '午餐', -1);
  if (dup) issues.push({ type: 'duplicate', message: '重复领取：同日同餐已有记录' });

  const limitCheck = dataParser.checkSubsidyLimit(student_id, subsidy_month || meal_date.substring(0, 7), amount);
  if (!limitCheck.passed) {
    limitCheck.results.forEach(r => issues.push(r));
  }

  res.json({ valid: issues.length === 0, issues, subsidy_info: limitCheck.subsidy });
});

module.exports = router;
