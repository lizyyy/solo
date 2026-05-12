const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const { store, db, initDatabase } = require('./database');
const billingEngine = require('./billing-engine');
const { loadSampleData } = require('./sample-data');

const app = express();
app.use(express.json());

initDatabase();

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/sample-data/load', (req, res) => {
  try {
    const data = loadSampleData();
    res.json({
      success: true,
      message: '样例数据已加载',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/operations', (req, res) => {
  const {
    idempotent_key,
    customer_id,
    operation_type,
    zone_id,
    product_sku,
    volume_cbm,
    operation_date,
    source_system,
    source_id
  } = req.body;

  if (!idempotent_key) {
    return res.status(400).json({ success: false, error: '缺少幂等键 idempotent_key' });
  }

  const existing = billingEngine.checkIdempotency(idempotent_key, 'OPERATION');
  if (existing) {
    return res.json({
      success: true,
      idempotent: true,
      message: '重复请求，已跳过处理',
      data: JSON.parse(existing.result)
    });
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    store.operations.push({
      id,
      idempotent_key,
      customer_id,
      operation_type,
      zone_id,
      product_sku,
      volume_cbm,
      operation_date,
      source_system,
      source_id,
      status: 'PENDING',
      error_message: null,
      created_at: now,
      processed_at: null
    });

    const result = {
      id,
      status: 'PENDING'
    };

    billingEngine.recordIdempotency(idempotent_key, 'OPERATION', id, 'SUCCESS', result);

    res.json({
      success: true,
      idempotent: false,
      data: result
    });
  } catch (error) {
    billingEngine.recordIdempotency(idempotent_key, 'OPERATION', null, 'ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/operations/:id/process', (req, res) => {
  const { id } = req.params;
  const operator = req.body.operator || 'system';

  try {
    const operation = store.operations.find(o => o.id === id);
    if (!operation) {
      return res.status(404).json({ success: false, error: '操作记录不存在' });
    }

    if (operation.status === 'PROCESSED') {
      return res.json({
        success: true,
        idempotent: true,
        message: '已处理，幂等返回',
        data: operation
      });
    }

    const zone = store.temperature_zones.find(z => z.id === operation.zone_id);
    const customer = store.customers.find(c => c.id === operation.customer_id);

    if (!zone || !customer) {
      operation.status = 'ERROR';
      operation.error_message = '无效的温区或客户';
      operation.processed_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      return res.status(400).json({ success: false, error: '无效的温区或客户' });
    }

    operation.status = 'PROCESSED';
    operation.processed_at = new Date().toISOString().replace('T', ' ').substring(0, 19);

    res.json({
      success: true,
      data: operation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/operations', (req, res) => {
  const { customer_id, status, operation_type } = req.query;
  
  let operations = [...store.operations];

  if (customer_id) {
    operations = operations.filter(o => o.customer_id === customer_id);
  }
  if (status) {
    operations = operations.filter(o => o.status === status);
  }
  if (operation_type) {
    operations = operations.filter(o => o.operation_type === operation_type);
  }

  operations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, data: operations });
});

app.post('/api/bills', (req, res) => {
  const { customer_id, period_start, period_end, operator } = req.body;

  if (!customer_id || !period_start || !period_end) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: customer_id, period_start, period_end'
    });
  }

  const idempotentKey = `BILL-${customer_id}-${period_start}-${period_end}`;
  const existing = billingEngine.checkIdempotency(idempotentKey, 'GENERATE_BILL');
  
  if (existing && existing.status === 'SUCCESS') {
    return res.json({
      success: true,
      idempotent: true,
      message: '重复生成请求，返回已有账单',
      data: JSON.parse(existing.result)
    });
  }

  try {
    const bill = billingEngine.generateBill(customer_id, period_start, period_end, operator);
    billingEngine.recordIdempotency(idempotentKey, 'GENERATE_BILL', bill.id, 'SUCCESS', bill);
    
    res.json({
      success: true,
      idempotent: false,
      data: bill
    });
  } catch (error) {
    billingEngine.recordIdempotency(idempotentKey, 'GENERATE_BILL', null, 'ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/bills', (req, res) => {
  const { customer_id, status } = req.query;
  
  let bills = [...store.bills].map(b => {
    const customer = store.customers.find(c => c.id === b.customer_id);
    return { ...b, customer_name: customer?.name };
  });

  if (customer_id) {
    bills = bills.filter(b => b.customer_id === customer_id);
  }
  if (status) {
    bills = bills.filter(b => b.status === status);
  }

  bills.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, data: bills });
});

app.get('/api/bills/:id', (req, res) => {
  const bill = billingEngine.getBillWithDetails(req.params.id);
  if (!bill) {
    return res.status(404).json({ success: false, error: '账单不存在' });
  }
  res.json({ success: true, data: bill });
});

app.post('/api/bills/:id/advance', (req, res) => {
  const { id } = req.params;
  const { target_status, operator, reason } = req.body;

  if (!target_status || !operator) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: target_status, operator'
    });
  }

  try {
    const bill = billingEngine.updateBillStatus(id, target_status, operator, reason || '状态推进');
    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/bills/:id/adjust', (req, res) => {
  const { id } = req.params;
  const { adjusted_by, adjustment_type, amount, reason } = req.body;

  if (!adjusted_by || !adjustment_type || amount === undefined || !reason) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: adjusted_by, adjustment_type, amount, reason'
    });
  }

  try {
    const bill = billingEngine.createAdjustment(id, adjusted_by, adjustment_type, amount, reason);
    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/bills/:id/export', (req, res) => {
  const { format = 'json' } = req.query;
  const bill = billingEngine.getBillWithDetails(req.params.id);

  if (!bill) {
    return res.status(404).json({ success: false, error: '账单不存在' });
  }

  if (format === 'csv') {
    const lineItems = bill.line_items.map(item => ({
      项目类型: item.line_type,
      描述: item.description,
      数量: item.quantity,
      单价: item.unit_price.toFixed(2),
      金额: item.amount.toFixed(2),
      阶梯: item.ladder_name || '-'
    }));

    const summary = [
      { 项目: '仓储费', 金额: bill.storage_fee.toFixed(2) },
      { 项目: '入库操作费', 金额: bill.in_operation_fee.toFixed(2) },
      { 项目: '出库操作费', 金额: bill.out_operation_fee.toFixed(2) },
      { 项目: '调账金额', 金额: bill.adjustment_amount.toFixed(2) },
      { 项目: '总计', 金额: bill.total_amount.toFixed(2) }
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bill-${bill.id}.csv"`);
    
    res.write('\ufeff');
    res.write('=== 账单汇总 ===\n');
    const summaryParser = new Parser();
    res.write(summaryParser.parse(summary));
    res.write('\n\n=== 明细项目 ===\n');
    const itemParser = new Parser();
    res.write(itemParser.parse(lineItems));
    res.end();
  } else {
    res.json({ success: true, data: bill });
  }
});

app.get('/api/bills/:id/age-details', (req, res) => {
  const { product_sku, zone_id } = req.query;
  const billId = req.params.id;

  let details = store.bill_age_details.filter(d => d.bill_id === billId);

  if (product_sku) {
    details = details.filter(d => d.product_sku === product_sku);
  }
  if (zone_id) {
    details = details.filter(d => d.zone_id === zone_id);
  }

  details = details.map(d => {
    const zone = store.temperature_zones.find(z => z.id === d.zone_id);
    return { ...d, zone_name: zone?.name, zone_code: zone?.code };
  });

  details.sort((a, b) => {
    const dateCompare = new Date(a.received_date) - new Date(b.received_date);
    if (dateCompare !== 0) return dateCompare;
    return a.age_days - b.age_days;
  });

  const summary = {};
  for (const d of details) {
    const key = `${d.ladder_name}-${d.zone_name}`;
    if (!summary[key]) {
      summary[key] = {
        ladder: d.ladder_name,
        zone: d.zone_name,
        total_days: 0,
        total_volume: 0,
        total_fee: 0
      };
    }
    summary[key].total_days += d.days_in_period;
    summary[key].total_volume += d.volume_cbm * d.days_in_period;
    summary[key].total_fee += d.total_fee;
  }

  res.json({
    success: true,
    summary: Object.values(summary),
    details: details
  });
});

app.get('/api/config/zones', (req, res) => {
  res.json({ success: true, data: [...store.temperature_zones] });
});

app.get('/api/config/age-ladders', (req, res) => {
  const ladders = [...store.age_ladders].sort((a, b) => a.min_days - b.min_days);
  res.json({ success: true, data: ladders });
});

app.get('/api/config/operation-ladders', (req, res) => {
  const ladders = [...store.operation_ladders].sort((a, b) => a.min_operations - b.min_operations);
  res.json({ success: true, data: ladders });
});

app.get('/api/config/zone-rates', (req, res) => {
  const rates = store.zone_rates.map(r => {
    const zone = store.temperature_zones.find(z => z.id === r.zone_id);
    return { ...r, zone_name: zone?.name, zone_code: zone?.code };
  });
  rates.sort((a, b) => {
    if (a.zone_code !== b.zone_code) return a.zone_code.localeCompare(b.zone_code);
    return a.effective_date.localeCompare(b.effective_date);
  });
  res.json({ success: true, data: rates });
});

app.get('/api/customers', (req, res) => {
  res.json({ success: true, data: [...store.customers] });
});

app.listen(PORT, () => {
  console.log(`仓储计费阶梯 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('快速开始:');
  console.log(`1. 加载样例数据: POST http://localhost:${PORT}/api/sample-data/load`);
  console.log(`2. 查看健康状态: GET http://localhost:${PORT}/health`);
  console.log(`3. 查看配置: GET http://localhost:${PORT}/api/config/zones`);
});

module.exports = app;
