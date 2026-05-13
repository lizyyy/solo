const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    let sql = `
      SELECT t.*, p.tracking_number, p.receiver_name
      FROM supplement_tickets t
      LEFT JOIN packages p ON t.package_id = p.id
      WHERE 1=1
    `;
    let params = [];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const tickets = await allQuery(sql, params);

    const countSql = sql.replace('SELECT t.*, p.tracking_number, p.receiver_name', 'SELECT COUNT(*) as total').split(' ORDER BY ')[0].split(' LIMIT ')[0];
    const countResult = await getQuery(countSql, params.slice(0, params.length - 2));

    res.json({
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, operator, notes } = req.body;
    const ticket = await getQuery('SELECT * FROM supplement_tickets WHERE id = ?', [req.params.id]);
    
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    await runQuery(
      'UPDATE supplement_tickets SET status = ?, current_owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, operator || ticket.current_owner, req.params.id]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'ticket_status_change', ?, ?)`,
      [uuidv4(), ticket.package_id, operator || 'system', JSON.stringify({ 
        ticket_id: req.params.id, 
        old_status: ticket.status, 
        new_status: status, 
        notes 
      })]
    );

    if (status === 'resolved') {
      const pkg = await getQuery('SELECT * FROM packages WHERE id = ?', [ticket.package_id]);
      if (pkg && pkg.status === 'supplement_required') {
        await runQuery(
          'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['supplement_completed', ticket.package_id]
        );
      }
    }

    const updatedTicket = await getQuery('SELECT * FROM supplement_tickets WHERE id = ?', [req.params.id]);
    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/escalate', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const ticket = await getQuery('SELECT * FROM supplement_tickets WHERE id = ?', [req.params.id]);
    
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    await runQuery(
      'UPDATE supplement_tickets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['urgent', req.params.id]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'ticket_escalated', ?, ?)`,
      [uuidv4(), ticket.package_id, operator || 'system', JSON.stringify({ 
        ticket_id: req.params.id, 
        reason,
        old_priority: ticket.priority,
        new_priority: 'urgent'
      })]
    );

    res.json({ message: '工单已升级', ticket_id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
