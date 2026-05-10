const express = require('express');
const router = express.Router();
const services = require('./services');
const models = require('./models');

const { getDb } = require('./database');

router.use(express.json());

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) });
});

router.post('/tickets', (req, res) => {
  const { event_id, seat_number, price } = req.body;
  
  if (!event_id || !seat_number || !price) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  try {
    const ticketId = models.createTicket(event_id, seat_number, price);
    res.json({ success: true, ticket_id: ticketId });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: '该座位已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/tickets/available', (req, res) => {
  const { event_id } = req.query;
  
  if (!event_id) {
    return res.status(400).json({ error: '缺少 event_id' });
  }
  
  const tickets = models.getAvailableTickets(event_id);
  res.json({ count: tickets.length, tickets });
});

router.post('/purchase', (req, res) => {
  const { event_id, user_id } = req.body;
  
  if (!event_id || !user_id) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const result = services.purchaseTicket(event_id, user_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/payments/confirm', (req, res) => {
  const { transaction_id } = req.body;
  
  if (!transaction_id) {
    return res.status(400).json({ error: '缺少 transaction_id' });
  }
  
  const result = services.confirmPayment(transaction_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/queue/join', (req, res) => {
  const { event_id, user_id, priority } = req.body;
  
  if (!event_id || !user_id) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const result = services.joinQueue(event_id, user_id, priority || 0);
  res.json(result);
});

router.get('/queue/status', (req, res) => {
  const { event_id, user_id } = req.query;
  
  if (!event_id || !user_id) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const status = services.getQueueStatus(event_id, user_id);
  res.json(status);
});

router.get('/queue/list', (req, res) => {
  const { event_id } = req.query;
  
  if (!event_id) {
    return res.status(400).json({ error: '缺少 event_id' });
  }
  
  const queue = models.getWaitlist(event_id);
  res.json({ count: queue.length, queue });
});

router.post('/queue/reject', (req, res) => {
  const { queue_id, user_id } = req.body;
  
  if (!queue_id || !user_id) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const result = services.rejectOffer(queue_id, user_id);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/refunds', (req, res) => {
  const { ticket_id, reason } = req.body;
  
  if (!ticket_id) {
    return res.status(400).json({ error: '缺少 ticket_id' });
  }
  
  const result = services.refundTicket(ticket_id, reason || '');
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
});

router.post('/admin/process-timeouts', (req, res) => {
  const paymentResult = services.processPaymentTimeouts();
  const queueResult = services.processQueueTimeouts();
  
  res.json({
    payment_timeouts_processed: paymentResult,
    queue_timeouts_processed: queueResult,
  });
});

router.get('/admin/failed-tasks', (req, res) => {
  const tasks = models.getRetryableFailedTasks();
  res.json({ count: tasks.length, tasks });
});

router.post('/admin/retry-task', (req, res) => {
  const { task_id } = req.body;
  
  if (!task_id) {
    return res.status(400).json({ error: '缺少 task_id' });
  }
  
  const db = getDb();
  const task = db.prepare('SELECT * FROM failed_tasks WHERE id = ?').get(task_id);
  
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  const payload = JSON.parse(task.payload);
  
  try {
    let result;
    switch (task.task_type) {
      case 'ESCALATION':
        const ticket = models.getTicketById(payload.ticketId);
        if (!ticket) throw new Error('票据不存在');
        const nextUser = models.getNextWaitlistUser(payload.eventId);
        if (nextUser) {
          result = services.escalateToNextUser(payload.eventId, ticket, nextUser, payload.fromUserId);
        }
        break;
      case 'TIMEOUT_PROCESS':
        result = services.processPaymentTimeouts();
        break;
      case 'QUEUE_TIMEOUT':
        result = services.processQueueTimeouts();
        break;
      default:
        throw new Error(`未知任务类型: ${task.task_type}`);
    }
    
    models.deleteFailedTask(task_id);
    res.json({ success: true, result });
  } catch (err) {
    if (task.attempts + 1 >= 5) {
      models.deleteFailedTask(task_id);
      res.status(500).json({ 
        success: false, 
        error: '重试次数已达上限，任务已移除',
        last_error: err.message 
      });
    } else {
      models.updateFailedTask(task_id, err.message);
      res.status(500).json({ 
        success: false, 
        error: err.message,
        attempts: task.attempts + 1
      });
    }
  }
});

router.get('/admin/reports', (req, res) => {
  const { event_id } = req.query;
  const db = getDb();
  
  let reports;
  if (event_id) {
    reports = db.prepare('SELECT * FROM escalation_reports WHERE event_id = ? ORDER BY created_at DESC').all(event_id);
  } else {
    reports = db.prepare('SELECT * FROM escalation_reports ORDER BY created_at DESC LIMIT 100').all();
  }
  
  res.json({ count: reports.length, reports });
});

module.exports = router;
