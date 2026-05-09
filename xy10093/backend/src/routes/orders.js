const express = require('express');
const router = express.Router();
const db = require('../db');

const addHistory = (orderId, action, details, operator = '操作员') => {
  const hist = db.history();
  hist.push({
    id: db.genId(hist),
    order_id: orderId,
    action,
    details,
    operator,
    created_at: db.now()
  });
  db.save();
};

router.get('/', (req, res) => {
  const { 
    keyword = '', 
    status = '', 
    start_date = '', 
    end_date = '',
    page = 1,
    page_size = 20
  } = req.query;

  const pageNum = parseInt(page, 10) || 1;
  const pageSize = parseInt(page_size, 10) || 20;
  const offset = (pageNum - 1) * pageSize;

  let list = db.orders().slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(o => 
      o.order_no.toLowerCase().includes(kw) || 
      o.product_name.toLowerCase().includes(kw) ||
      (o.batch_no || '').toLowerCase().includes(kw)
    );
  }
  if (status) {
    list = list.filter(o => o.current_status === status);
  }
  if (start_date) {
    list = list.filter(o => new Date(o.created_at) >= new Date(start_date));
  }
  if (end_date) {
    list = list.filter(o => new Date(o.created_at) <= new Date(end_date + 'T23:59:59'));
  }

  const total = list.length;
  const paged = list.slice(offset, offset + pageSize);

  const withCounts = paged.map(o => ({
    ...o,
    rework_count: db.records().filter(r => r.order_id === o.id).length,
    latest_rework_no: Math.max(0, ...db.records().filter(r => r.order_id === o.id).map(r => r.rework_count))
  }));

  res.json({
    total,
    page: pageNum,
    page_size: pageSize,
    data: withCounts
  });
});

router.get('/:id', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const order = db.orders().find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: '返工单不存在' });
  }

  const records = db.records().filter(r => r.order_id === orderId).sort((a, b) => a.rework_count - b.rework_count).map(r => ({
    ...r,
    quality_checks: db.checks().filter(qc => qc.rework_record_id === r.id)
  }));

  const history = db.history().filter(h => h.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const anomalies = db.anomalies().filter(a => a.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({
    order,
    rework_records: records,
    history,
    anomalies
  });
});

router.post('/', (req, res) => {
  const { order_no, product_name, batch_no, qty, defect_qty } = req.body;
  
  if (!order_no || !product_name) {
    return res.status(400).json({ error: '返工单号和产品名称不能为空' });
  }

  const existing = db.orders().find(o => o.order_no === order_no);
  if (existing) {
    return res.status(400).json({ error: '返工单号已存在' });
  }

  const orders = db.orders();
  const newOrder = {
    id: db.genId(orders),
    order_no,
    product_name,
    batch_no: batch_no || '',
    qty: qty || 0,
    defect_qty: defect_qty || 0,
    current_status: 'pending',
    created_at: db.now(),
    updated_at: db.now()
  };
  orders.push(newOrder);
  db.save();
  
  addHistory(newOrder.id, 'create', `创建返工单 ${order_no}`, '系统');
  
  res.json({ id: newOrder.id });
});

router.put('/:id', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { product_name, batch_no, qty, defect_qty, current_status } = req.body;
  
  const order = db.orders().find(o => o.id === orderId);
  if (order) {
    order.product_name = product_name || order.product_name;
    order.batch_no = batch_no || order.batch_no;
    order.qty = qty || order.qty;
    order.defect_qty = defect_qty || order.defect_qty;
    order.current_status = current_status || order.current_status;
    order.updated_at = db.now();
    db.save();
  }
  
  addHistory(orderId, 'update', '更新返工单基本信息');
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  
  data = db.load();
  data.rework_orders = data.rework_orders.filter(o => o.id !== orderId);
  data.rework_records = data.rework_records.filter(r => r.order_id !== orderId);
  const recordIds = data.rework_records.filter(r => r.order_id === orderId).map(r => r.id);
  data.quality_checks = data.quality_checks.filter(qc => !recordIds.includes(qc.rework_record_id));
  data.anomalies = data.anomalies.filter(a => a.order_id !== orderId);
  data.order_history = data.order_history.filter(h => h.order_id !== orderId);
  db.save();
  
  res.json({ success: true });
});

router.post('/:id/records', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const order = db.orders().find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: '返工单不存在' });
  }

  const { defect_description, root_cause, cause_category, responsible_process, responsible_person, correction_action, correction_date } = req.body;

  const counts = db.records().filter(r => r.order_id === orderId).map(r => r.rework_count);
  const reworkCount = counts.length > 0 ? Math.max(...counts) + 1 : 1;

  const records = db.records();
  const newRecord = {
    id: db.genId(records),
    order_id: orderId,
    rework_count: reworkCount,
    defect_description: defect_description || '',
    root_cause: root_cause || '',
    cause_category: cause_category || '',
    responsible_process: responsible_process || '',
    responsible_person: responsible_person || '',
    correction_action: correction_action || '',
    correction_date: correction_date || '',
    created_at: db.now()
  };
  records.push(newRecord);
  
  order.current_status = 'in_progress';
  order.updated_at = db.now();
  db.save();

  addHistory(orderId, 'add_record', `第${reworkCount}次返工记录`, responsible_person);

  res.json({ id: newRecord.id, rework_count: reworkCount });
});

router.post('/records/:recordId/quality-check', (req, res) => {
  const recordId = parseInt(req.params.recordId, 10);
  const record = db.records().find(r => r.id === recordId);
  if (!record) {
    return res.status(404).json({ error: '返工记录不存在' });
  }

  const { inspector, check_date, check_result, defect_items, final_conclusion } = req.body;
  
  const checks = db.checks();
  const newCheck = {
    id: db.genId(checks),
    rework_record_id: recordId,
    inspector: inspector || '',
    check_date: check_date || '',
    check_result: check_result || '',
    defect_items: defect_items || '',
    final_conclusion: final_conclusion || '',
    created_at: db.now()
  };
  checks.push(newCheck);

  const order = db.orders().find(o => o.id === record.order_id);
  
  if (check_result === 'pass') {
    order.current_status = 'closed';
    order.updated_at = db.now();
    addHistory(record.order_id, 'close', `质检通过，工单闭环`, inspector);
  } else if (check_result === 'rework_required') {
    order.current_status = 'in_progress';
    order.updated_at = db.now();
    addHistory(record.order_id, 'qc_check', `质检结论: 需再次返工`, inspector);
  } else {
    addHistory(record.order_id, 'qc_check', `质检结论: ${check_result || '待确认'}`, inspector);
  }

  db.save();

  res.json({ id: newCheck.id });
});

router.post('/:id/close', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { close_note, operator } = req.body;
  
  const order = db.orders().find(o => o.id === orderId);
  if (order) {
    order.current_status = 'closed';
    order.updated_at = db.now();
    db.save();
  }
  
  addHistory(orderId, 'close', close_note || '手动关闭工单', operator);

  res.json({ success: true });
});

router.get('/stats/summary', (req, res) => {
  const orders = db.orders();
  const total = orders.length;
  const pending = orders.filter(o => o.current_status === 'pending').length;
  const inProgress = orders.filter(o => o.current_status === 'in_progress').length;
  const closed = orders.filter(o => o.current_status === 'closed').length;
  const openAnomalies = db.anomalies().filter(a => a.status === 'open').length;
  
  const highReorder = orders
    .map(o => ({
      ...o,
      rework_count: db.records().filter(r => r.order_id === o.id).length
    }))
    .filter(o => o.rework_count >= 2);

  res.json({
    total,
    pending,
    in_progress: inProgress,
    closed,
    open_anomalies: openAnomalies,
    high_rework_orders: highReorder
  });
});

module.exports = router;
