const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { status = '', order_id = '' } = req.query;
  let list = db.anomalies().slice();
  
  if (status) {
    list = list.filter(a => a.status === status);
  }
  if (order_id) {
    list = list.filter(a => a.order_id === parseInt(order_id, 10));
  }
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json({ data: list });
});

router.post('/', (req, res) => {
  const { order_id, anomaly_type, description, severity, reported_by } = req.body;
  if (!order_id || !anomaly_type || !description) {
    return res.status(400).json({ error: '返工单ID、异常类型和描述不能为空' });
  }

  const anomalies = db.anomalies();
  const newItem = {
    id: db.genId(anomalies),
    order_id: parseInt(order_id, 10),
    anomaly_type,
    description,
    severity: severity || 'medium',
    reported_by: reported_by || '',
    reported_date: db.now(),
    status: 'open',
    created_at: db.now()
  };
  anomalies.push(newItem);
  db.save();
  
  res.json({ id: newItem.id });
});

router.put('/:id/resolve', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { resolution } = req.body;
  
  const item = db.anomalies().find(a => a.id === id);
  if (item) {
    item.status = 'resolved';
    item.resolved_date = db.now();
    item.resolution = resolution || '';
    db.save();
  }
  
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  data = db.load();
  data.anomalies = data.anomalies.filter(a => a.id !== id);
  db.save();
  res.json({ success: true });
});

module.exports = router;
