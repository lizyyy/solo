const fs = require('fs');
const content = `const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const exportDir = path.join(__dirname, 'data/exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new sqlite3.Database(dbPath);

function generateMaterialHash(materials) {
  const sorted = JSON.stringify(materials, Object.keys(materials).sort());
  return crypto.createHash('sha256').update  return crypto.crex');
}
function generateId() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

const BATCH_STATUS = {
  PROCESSING: 'processing',
  FAILED: 'failed',
  MANUAL_CONFIRM: 'manual_confirm',
  EXPORTED: 'exported'
};

function initDB() {
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run('CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, material_hash TEXT UNIQUE, status TEXT, operator TEXT, remark TEXT, created_at INTEGER, updated_at INTEGER)');
      db.run('CREATE TABLE IF NOT EXISTS refund_records (id TEXT PRIMARY KEY, batch_id TEXT, order_no TEXT, payment_channel TEXT, pile_start_log TEXT, customer_service_remark TEXT, amount REAL, charge_duration INTEGER, start_time INTEGER, end_time INTEGER, pile_id TEXT, user_id TEXT, conclusion TEXT, conclusion_reason TEXT, operator TEXT, created_at INTEGER, updated_at INTEGER)');
      db.run('CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, record_id TEXT, batch_id TEXT, field_name TEXT, old_value TEXT, new_value TEXT, operator TEXT, reason TEXT, created_at INTEGER)');
      resolve();
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

async function logChange(recordId, batchId, fieldName, oldValue, newValue, operator, reason) {
  await run('INSERT INTO audit_logs (id, record_id, batch_id, field_name, old_value, new_value, operator, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [generateId(), recordId, batchId, fieldName, String(oldValue), String(newValue), operator, reason, now()]);
}

function analyzeRefund(record) {
  const pileLog = JSON.parse(record.pile_start_log || '{}');
  const amount = record.amount;
  const duration = record.charge_duration;
  let conclusion = 'pending', reason = '';
  if (!pileLog || !pileLog.startTime) { conclusion = 'manual_review'; reason = '桩端启动日志不完整，需要人工审核'; }
  else if (amount <= 0) { conclusion = 'refund_full'; reason = '订单金额异常，全额退款'; }
  else if (duration < 60) { conclusion = 'refund_partial'; reason = '充电时长仅' + duration + '秒，部分退款'; }
  else { conclusion = 'normal'; reason = '订单正常，无需退款'; }
  return { conclusion, reason };
}

async function processBatch(batchId) {
  const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [batchId]);
  for (const record of records) {
    const { conclusion, reason } = analyzeRefund(record);
    await run('UPDATE refund_records SET conclusion = ?, conclusion_reason = ?, updated_at = ? WHERE id = ?', [conclusion, reason, now(), record.id]);
    await logChange(record.id, batchId, 'conclusion', 'pending', conclusion, 'system', reason);
  }
  await run('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?', [BATCH_STATUS.MANUAL_CONFIRM, now(), batchId]);
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/batches', async (req, res) => {
  try {
    const { materials, operator, remark } = req.body;
    if (!materials || !Array.isArray(materials)) return res.status(400).json({ error: 'materials必须是数组' });
    if (!operator) return res.status(400).json({ error: 'operator是必填项' });
    
    const materialHash = generateMaterialHash(materials);
    const existingBatch = await get('SELECT * FROM batches WHERE material_hash = ?', [materialHash]);
    
    if (existingBatch) {
      const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [existingBatch.id]);
      return res.json({ message: '检测到重复提交，返回已有处理结果', isDuplicate: true, batch: existingBatch, records });
    }
    
    const batchId = generateId();
    const timestamp = now();
    await run('INSERT INTO batches (id, material_hash, status, operator, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [batchId, materialHash, BATCH_STATUS.PROCESSING, operator, remark || '', timestamp, timestamp]);
    
    for (const m of materials) {
      await run('INSERT INTO refund_records (id, batch_id, order_no, payment_channel, pile_start_log, customer_service_remark, amount, charge_duration, start_time, end_time, pile_id, user_id, conclusion, operator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), batchId, m.orderNo, m.paymentChannel, JSON.stringify(m.pileStartLog || {}), m.customerServiceRemark || '', m.amount || 0, m.chargeDuration || 0, m.startTime || 0, m.endTime || 0, m.pileId || '', m.userId || '', 'pending', operator, timestamp, timestamp]);
    }
    
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [batchId]);
    
    setTimeout(() => processBatch(batchId).catch(e => {
      console.error('处理失败:', e);
      run('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?', [BATCH_STATUS.FAILED, now(), batchId]);
    }), 100);
    
    res.status(201).json({ message: '批次创建成功', isDuplicate: false, batch, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/batches', async (req, res) => {
  try { res.json(await all('SELECT * FROM batches ORDER BY created_at DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batches/:batchId', async (req, res) => {
  try {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [req.params.batchId]);
    res.json({ batch, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/records/:recordId/conclusion', async (req, res) => {
  try {
    const { conclusion, reason, operator } = req.body;
    if (!conclusion || !operator) return res.status(400).json({ error: 'conclusion和operator是必填项' });
    const record = await get('SELECT * FROM refund_records WHERE id = ?', [req.params.recordId]);
    if (!record) return res.status(404).json({ error: '记录不存在' });
    
    await logChange(record.id, record.batch_id, 'conclusion', record.conclusion, conclusion, operator, reason || '');
    await run('UPDATE refund_records SET conclusion = ?, conclusion_reason = ?, operator = ?, updated_at = ? WHERE id = ?', [conclusion, reason || '', operator, now(), record.id]);
    
    res.json({ message: '结论更新成功', record: await get('SELECT * FROM refund_records WHERE id = ?', [record.id]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/records/:recordId/audit-logs', async (req, res) => {
  try { res.json(await all('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC', [req.params.recordId])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batches/:batchId/audit-logs', async (req, res) => {
  try { res.json(await all('SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC', [req.params.batchId])); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/batches/:batchId/export', async (req, res) => {
  try {
    const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [req.params.batchId]);
    const filePath = path.join(exportDir, 'batch-' + req.params.batchId + '.csv');
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'order_no', title: '订单号' },
        { id: 'payment_channel', title: '支付渠道' },
        { id: 'amount', title: '订单金额' },
        { id: 'conclusion', title: '审核结论' },
        { id: 'conclusion_reason', title: '结论原因' },
        { id: 'customer_service_remark', title: '客服备注' },
        { id: 'operator', title: '操作人' }
      ]
    });
    await csvWriter.writeRecords(records);
    await run('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?', [BATCH_STATUS.EXPORTED, now(), req.params.batchId]);
    res.json({ message: '导出成功', filePath, recordCount: records.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/batches/:batchId/download', async (req, res) => {
  try {
    const records = await all('SELECT * FROM refund_records WHERE batch_id = ?', [req.params.batchId]);
    const filePath = path.join(exportDir, 'batch-' + req.params.batchId + '.csv');
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'order_no', title: '订单号' },
        { id: 'payment_channel', title: '支付渠道' },
        { id: 'amount', title: '订单金额' },
        { id: 'conclusion', title: '审核结论' },
        { id: 'conclusion_reason', title: '结论原因' },
        { id: 'customer_service_remark', title: '客服备注' },
        { id: 'operator', title: '操作人' }
      ]
    });
    await csvWriter.writeRecords(records);
    res.download(filePath, 'refund-batch-' + req.params.batchId + '.csv');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log('Server running on port', PORT));
}
start();
`;
fs.writeFileSync('src/index.js', content);
console.log('index.js created');
