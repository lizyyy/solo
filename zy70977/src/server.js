const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { initDatabase, get, all } = require('./database');
const { parseRentalCSV, parseRepairJSON, parseDepositRules } = require('./parsers');
const {
  generateBatchId,
  checkBatchExists,
  createBatch,
  updateBatchCounts,
  processRentalOrders,
  processRepairRecords,
  processDepositRules,
  getBatchResult
} = require('./importService');
const { getDepositBalance } = require('./rulesEngine');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(express.json());

function hashFileContent(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

app.post('/api/import/rental', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const fileHash = hashFileContent(req.file.path);
    const existingBatch = await checkBatchExists('rental', fileHash);
    if (existingBatch) {
      const result = await getBatchResult(existingBatch.batch_id);
      fs.unlinkSync(req.file.path);
      return res.json({
        message: '该文件已导入过，返回上次结果',
        isDuplicate: true,
        batch_id: existingBatch.batch_id,
        ...result
      });
    }

    const orders = await parseRentalCSV(req.file.path);
    const batchId = generateBatchId('rental', fileHash);
    await createBatch(batchId, 'rental', req.file.originalname, orders.length);

    const results = await processRentalOrders(batchId, orders);
    await updateBatchCounts(batchId);

    fs.unlinkSync(req.file.path);

    res.json({
      batch_id: batchId,
      total: orders.length,
      success_count: results.success.length,
      pending_count: results.pending.length,
      failed_count: results.failed.length,
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/repair', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const fileHash = hashFileContent(req.file.path);
    const existingBatch = await checkBatchExists('repair', fileHash);
    if (existingBatch) {
      const result = await getBatchResult(existingBatch.batch_id);
      fs.unlinkSync(req.file.path);
      return res.json({
        message: '该文件已导入过，返回上次结果',
        isDuplicate: true,
        batch_id: existingBatch.batch_id,
        ...result
      });
    }

    const repairs = await parseRepairJSON(req.file.path);
    const batchId = generateBatchId('repair', fileHash);
    await createBatch(batchId, 'repair', req.file.originalname, repairs.length);

    const results = await processRepairRecords(batchId, repairs);
    await updateBatchCounts(batchId);

    fs.unlinkSync(req.file.path);

    res.json({
      batch_id: batchId,
      total: repairs.length,
      success_count: results.success.length,
      pending_count: results.pending.length,
      failed_count: results.failed.length,
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/rules', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const fileHash = hashFileContent(req.file.path);
    const existingBatch = await checkBatchExists('rules', fileHash);
    if (existingBatch) {
      const result = await getBatchResult(existingBatch.batch_id);
      fs.unlinkSync(req.file.path);
      return res.json({
        message: '该文件已导入过，返回上次结果',
        isDuplicate: true,
        batch_id: existingBatch.batch_id,
        ...result
      });
    }

    const rules = await parseDepositRules(req.file.path);
    const batchId = generateBatchId('rules', fileHash);
    await createBatch(batchId, 'rules', req.file.originalname, rules.length);

    const results = await processDepositRules(batchId, rules);
    await updateBatchCounts(batchId);

    fs.unlinkSync(req.file.path);

    res.json({
      batch_id: batchId,
      total: rules.length,
      success_count: results.success.length,
      pending_count: results.pending.length,
      failed_count: results.failed.length,
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/batch/:batchId', async (req, res) => {
  const result = await getBatchResult(req.params.batchId);
  if (!result) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(result);
});

app.get('/api/batches', async (req, res) => {
  const batches = await all(`
    SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 100
  `);
  res.json(batches);
});

app.get('/api/deposit/trace/:orderNo', async (req, res) => {
  const orderNo = req.params.orderNo;
  const order = await get('SELECT * FROM rental_orders WHERE order_no = ?', [orderNo]);
  if (!order) {
    return res.status(404).json({ error: '租赁订单不存在' });
  }

  const transactions = await all(`
    SELECT dt.*,
      ro.customer_name,
      ro.device_id,
      rr.repair_type,
      dr.rule_name
    FROM deposit_transactions dt
    LEFT JOIN rental_orders ro ON dt.rental_order_no = ro.order_no
    LEFT JOIN repair_records rr ON dt.repair_no = rr.repair_no
    LEFT JOIN deposit_rules dr ON dt.rule_code = dr.rule_code
    WHERE dt.rental_order_no = ?
    ORDER BY dt.created_at ASC
  `, [orderNo]);

  const balance = await getDepositBalance(orderNo);

  const trace = transactions.map(t => ({
    transaction_no: t.transaction_no,
    transaction_type: t.transaction_type,
    type_desc: t.transaction_type === 'deposit' ? '押金收取' :
               t.transaction_type === 'deduction' ? '押金扣减' :
               t.transaction_type === 'refund' ? '押金退还' : t.transaction_type,
    amount: t.amount,
    balance_after: t.balance,
    reason: t.reason,
    source_type: t.source_type,
    source_id: t.source_id,
    rule_name: t.rule_name,
    repair_type: t.repair_type,
    created_at: t.created_at,
    trace_path: {
      from_order: t.rental_order_no,
      from_repair: t.repair_no,
      from_rule: t.rule_code
    }
  }));

  res.json({
    order_no: orderNo,
    customer_name: order.customer_name,
    device_id: order.device_id,
    total_deposit: order.deposit_amount,
    ...balance,
    transactions: trace,
    trace_summary: {
      total_transactions: trace.length,
      first_transaction: trace[0]?.created_at,
      last_transaction: trace[trace.length - 1]?.created_at
    }
  });
});

app.get('/api/deposit/balance/:orderNo', async (req, res) => {
  const balance = await getDepositBalance(req.params.orderNo);
  if (balance.totalDeposit === 0) {
    return res.status(404).json({ error: '未找到该订单的押金记录' });
  }
  res.json({
    order_no: req.params.orderNo,
    ...balance
  });
});

app.get('/api/rental/orders', async (req, res) => {
  const { customer, device, status } = req.query;
  let sql = 'SELECT * FROM rental_orders WHERE 1=1';
  const params = [];

  if (customer) { sql += ' AND customer_name LIKE ?'; params.push(`%${customer}%`); }
  if (device) { sql += ' AND device_id = ?'; params.push(device); }
  if (status) { sql += ' AND status = ?'; params.push(status); }

  sql += ' ORDER BY created_at DESC LIMIT 100';
  const orders = await all(sql, params);
  res.json(orders);
});

app.get('/api/repair/records', async (req, res) => {
  const { device, order_no } = req.query;
  let sql = 'SELECT * FROM repair_records WHERE 1=1';
  const params = [];

  if (device) { sql += ' AND device_id = ?'; params.push(device); }
  if (order_no) { sql += ' AND rental_order_no = ?'; params.push(order_no); }

  sql += ' ORDER BY created_at DESC LIMIT 100';
  const records = await all(sql, params);
  res.json(records);
});

app.get('/api/rules', async (req, res) => {
  const rules = await all('SELECT * FROM deposit_rules ORDER BY priority ASC');
  res.json(rules);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`设备租赁服务已启动: http://localhost:${PORT}`);
      console.log('健康检查: GET /api/health');
    });
  } catch (e) {
    console.error('数据库初始化失败:', e);
    process.exit(1);
  }
}

startServer();
