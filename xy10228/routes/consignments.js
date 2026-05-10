const express = require('express');
const router = express.Router();
const { db, getNextId, now } = require('../database');
const utils = require('../utils');

router.get('/', async (req, res) => {
  await db.read();
  const { status } = req.query;
  let consignments = [...db.data.consignments];
  
  if (status) {
    consignments = consignments.filter(c => c.status === status);
  }
  
  consignments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const result = consignments.map(c => ({
    ...c,
    status_info: utils.getConsignmentStatusInfo(c.status)
  }));
  
  res.json(result);
});

router.post('/', async (req, res) => {
  const { camera_brand, camera_model, serial_number, customer_name, customer_phone, expected_price } = req.body;
  
  if (!camera_brand || !camera_model || !customer_name) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  await db.read();
  const order_no = utils.generateOrderNo();
  const id = getNextId('consignments');
  
  const consignment = {
    id,
    order_no,
    camera_brand,
    camera_model,
    serial_number: serial_number || null,
    customer_name,
    customer_phone: customer_phone || null,
    expected_price: expected_price || null,
    status: 'pending',
    created_at: now(),
    updated_at: now()
  };
  
  db.data.consignments.push(consignment);
  
  await utils.recordHistory(id, 'create', null, null, { order_no, camera_brand, camera_model }, '寄卖单创建');
  
  for (const name of utils.STANDARD_ACCESSORIES) {
    db.data.accessories.push({
      id: getNextId('accessories'),
      consignment_id: id,
      name,
      present: 0,
      condition: null,
      notes: null,
      created_at: now()
    });
  }
  
  await db.write();
  res.json({ id, order_no, status: 'pending' });
});

router.get('/:id', async (req, res) => {
  await db.read();
  const consignment = db.data.consignments.find(c => c.id === parseInt(req.params.id));
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  
  res.json({
    ...consignment,
    status_info: utils.getConsignmentStatusInfo(consignment.status)
  });
});

router.put('/:id/status', async (req, res) => {
  const { status, notes } = req.body;
  if (!status) return res.status(400).json({ error: '缺少状态字段' });
  
  try {
    const result = await utils.updateConsignmentStatus(parseInt(req.params.id), status, notes);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  await db.read();
  const consignment = db.data.consignments.find(c => c.id === parseInt(req.params.id));
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  
  const fields = ['camera_brand', 'camera_model', 'serial_number', 'customer_name', 'customer_phone', 'expected_price'];
  const updated = [];
  
  for (const field of fields) {
    if (req.body[field] !== undefined && req.body[field] !== consignment[field]) {
      const oldValue = consignment[field];
      consignment[field] = req.body[field];
      updated.push(field);
      await utils.recordHistory(consignment.id, 'update', field, oldValue, req.body[field], `修改${field}`);
    }
  }
  
  if (updated.length === 0) {
    return res.json({ success: true, message: '无变更' });
  }
  
  consignment.updated_at = now();
  await db.write();
  
  res.json({ success: true, updated_fields: updated });
});

router.post('/:id/withdraw', async (req, res) => {
  const { notes } = req.body;
  
  await db.read();
  const consignment = db.data.consignments.find(c => c.id === parseInt(req.params.id));
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  
  const terminalStatuses = ['sold', 'rejected', 'withdrawn'];
  if (terminalStatuses.includes(consignment.status)) {
    return res.status(400).json({ error: '当前状态不允许撤回' });
  }
  
  const oldStatus = consignment.status;
  consignment.status = 'withdrawn';
  consignment.updated_at = now();
  await db.write();
  
  await utils.recordHistory(consignment.id, 'withdraw', 'status', oldStatus, 'withdrawn', notes || '用户撤回');
  
  res.json({ success: true, oldStatus, newStatus: 'withdrawn' });
});

module.exports = router;
