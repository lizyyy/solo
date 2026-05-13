const express = require('express');
const router = express.Router();
const { run, get, all, uuidv4 } = require('../database');

const logOperation = async (operator, action, module, recordId, details) => {
  await run(
    'INSERT INTO operation_logs (id, operator, action, module, record_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), operator, action, module, recordId, JSON.stringify(details)]
  );
};

router.get('/', async (req, res) => {
  try {
    const { device_id, assignee, status, priority } = req.query;
    let sql = 'SELECT * FROM repair_tickets WHERE 1=1';
    const params = [];
    
    if (device_id) {
      sql += ' AND device_id = ?';
      params.push(device_id);
    }
    if (assignee) {
      sql += ' AND assignee = ?';
      params.push(assignee);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    const tickets = await all(sql, params);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await get('SELECT * FROM repair_tickets WHERE id = ?', [req.params.id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ticket_no, device_id, order_id, reporter, assignee, issue_type, description, priority = 'medium', status = 'open', operator = reporter } = req.body;
    const id = uuidv4();
    
    await run(
      'INSERT INTO repair_tickets (id, ticket_no, device_id, order_id, reporter, assignee, issue_type, description, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, ticket_no, device_id, order_id, reporter, assignee, issue_type, description, priority, status]
    );
    
    await logOperation(operator, 'create', 'repair_ticket', id, { ticket_no, issue_type, status, assignee });
    
    const ticket = await get('SELECT * FROM repair_tickets WHERE id = ?', [id]);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, assignee, description, operator = 'system' } = req.body;
    
    const existing = await get('SELECT * FROM repair_tickets WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    await run(
      'UPDATE repair_tickets SET status = ?, assignee = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, assignee, description, req.params.id]
    );
    
    await logOperation(operator, 'update', 'repair_ticket', req.params.id, {
      before: { status: existing.status, assignee: existing.assignee },
      after: { status, assignee }
    });
    
    const ticket = await get('SELECT * FROM repair_tickets WHERE id = ?', [req.params.id]);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
