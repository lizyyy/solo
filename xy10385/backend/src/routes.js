const express = require('express');
const DAOs = require('./daos');
const { OrderService, ScheduleService } = require('./services');

const router = express.Router();

function handleAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/patients', handleAsync(async (req, res) => {
  res.json(DAOs.PatientDAO.getAll());
}));

router.post('/patients', handleAsync(async (req, res) => {
  const patient = DAOs.PatientDAO.create(req.body);
  res.json(patient);
}));

router.get('/escorts', handleAsync(async (req, res) => {
  res.json(DAOs.EscortDAO.getAll());
}));

router.post('/escorts', handleAsync(async (req, res) => {
  const escort = DAOs.EscortDAO.create(req.body);
  res.json(escort);
}));

router.get('/examinations', handleAsync(async (req, res) => {
  res.json(DAOs.ExaminationDAO.getAll());
}));

router.post('/examinations', handleAsync(async (req, res) => {
  const exam = DAOs.ExaminationDAO.create(req.body);
  res.json(exam);
}));

router.get('/orders', handleAsync(async (req, res) => {
  const { status, escort_id } = req.query;
  const orders = DAOs.OrderDAO.getAll({ status, escort_id });
  res.json(orders);
}));

router.get('/orders/:id', handleAsync(async (req, res) => {
  const order = OrderService.getOrderDetail(req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  res.json(order);
}));

router.post('/orders', handleAsync(async (req, res) => {
  try {
    const order = OrderService.createOrder(req.body);
    res.json(order);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.put('/orders/:id', handleAsync(async (req, res) => {
  try {
    const result = OrderService.updateOrder(req.params.id, req.body);
    res.json({ success: true, result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/orders/:id/timeline', handleAsync(async (req, res) => {
  try {
    const { node_type, operator, notes } = req.body;
    const result = OrderService.advanceTimeline(req.params.id, node_type, operator, notes);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/orders/:id/examinations', handleAsync(async (req, res) => {
  try {
    const { examination_id, operator } = req.body;
    const result = OrderService.addExamination(req.params.id, examination_id, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/order-examinations/:id/approve', handleAsync(async (req, res) => {
  try {
    const { operator } = req.body;
    const result = OrderService.approveExamination(req.params.id, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/order-examinations/:id/reject', handleAsync(async (req, res) => {
  try {
    const { operator } = req.body;
    const result = OrderService.rejectExamination(req.params.id, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.get('/approvals/pending', handleAsync(async (req, res) => {
  const allExams = DAOs.db.prepare(`
    SELECT oe.*, o.order_no, p.name as patient_name, e.name as exam_name, e.department, e.price
    FROM order_examinations oe
    JOIN orders o ON oe.order_id = o.id
    JOIN patients p ON o.patient_id = p.id
    JOIN examinations e ON oe.examination_id = e.id
    WHERE oe.is_added = 1 AND oe.approval_status = 'pending'
    ORDER BY oe.created_at DESC
  `).all();
  res.json(allExams);
}));

router.post('/orders/:id/bill', handleAsync(async (req, res) => {
  try {
    const { operator } = req.body;
    const result = OrderService.billOrder(req.params.id, operator);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/orders/:id/cancel', handleAsync(async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = OrderService.cancelOrder(req.params.id, operator, reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.post('/orders/:id/refund', handleAsync(async (req, res) => {
  try {
    const { refund_amount, operator, reason } = req.body;
    const result = OrderService.refundOrder(req.params.id, refund_amount, operator, reason);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));

router.get('/orders/:id/report', handleAsync(async (req, res) => {
  const report = OrderService.generateReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: '订单不存在' });
  }
  res.json(report);
}));

router.get('/escorts/:id/schedule', handleAsync(async (req, res) => {
  const { date, start_date, end_date } = req.query;
  let schedules;
  if (start_date && end_date) {
    schedules = ScheduleService.getEscortScheduleRange(req.params.id, start_date, end_date);
  } else if (date) {
    schedules = ScheduleService.getEscortAvailability(req.params.id, date);
  } else {
    const today = new Date().toISOString().split('T')[0];
    schedules = ScheduleService.getEscortAvailability(req.params.id, today);
  }
  res.json(schedules);
}));

router.post('/schedules/check', handleAsync(async (req, res) => {
  const { escort_id, date, start_time, end_time } = req.body;
  const result = ScheduleService.checkConflict(escort_id, date, start_time, end_time);
  res.json(result);
}));

router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器错误' });
});

module.exports = router;
