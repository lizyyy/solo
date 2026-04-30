const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db');
const { 
  STATUS_MAP, 
  canTransition, 
  getDisabledReason, 
  getTransitionReason,
  generateTicketNo,
  getNextStatuses
} = require('../utils/statusFlow');

const router = express.Router();

const validatePhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone);
};

router.get('/', [
  query('status').optional().isIn(Object.keys(STATUS_MAP)),
  query('keyword').optional().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '参数错误', 
      errors: errors.array() 
    });
  }

  const { status, keyword, page = 1, pageSize = 20 } = req.query;
  
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];
  let countSql = 'SELECT COUNT(*) as total FROM tickets WHERE 1=1';
  const countParams = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
    countSql += ' AND status = ?';
    countParams.push(status);
  }

  if (keyword) {
    const keywordPattern = `%${keyword}%`;
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ? OR device_model LIKE ?)';
    params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    countSql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ? OR device_model LIKE ?)';
    countParams.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, (page - 1) * pageSize);

  db.get(countSql, countParams, (err, countRow) => {
    if (err) {
      console.error('查询总数失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '查询失败' 
      });
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('查询工单失败:', err);
        return res.status(500).json({ 
          success: false, 
          message: '查询失败' 
        });
      }

      const tickets = rows.map(row => ({
        ...row,
        statusLabel: STATUS_MAP[row.status]?.label || row.status,
        statusColor: STATUS_MAP[row.status]?.color || '#909399',
        nextStatuses: getNextStatuses(row.status)
      }));

      res.json({
        success: true,
        data: {
          tickets,
          total: countRow.total,
          page,
          pageSize
        }
      });
    });
  });
});

router.get('/kanban', (req, res) => {
  const { keyword } = req.query;
  
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (keyword) {
    const keywordPattern = `%${keyword}%`;
    sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ? OR device_model LIKE ?)';
    params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('查询工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '查询失败' 
      });
    }

    const kanban = {};
    Object.keys(STATUS_MAP).forEach(status => {
      kanban[status] = {
        label: STATUS_MAP[status].label,
        color: STATUS_MAP[status].color,
        tickets: []
      };
    });

    rows.forEach(row => {
      const ticket = {
        ...row,
        statusLabel: STATUS_MAP[row.status]?.label || row.status,
        statusColor: STATUS_MAP[row.status]?.color || '#909399',
        nextStatuses: getNextStatuses(row.status)
      };
      
      if (kanban[row.status]) {
        kanban[row.status].tickets.push(ticket);
      }
    });

    res.json({
      success: true,
      data: kanban
    });
  });
});

router.get('/:id', [
  param('id').isInt({ min: 1 }).toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '参数错误', 
      errors: errors.array() 
    });
  }

  const { id } = req.params;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      console.error('查询工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '查询失败' 
      });
    }

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: '工单不存在' 
      });
    }

    db.all('SELECT * FROM status_logs WHERE ticket_id = ? ORDER BY created_at ASC', [id], (err, logs) => {
      if (err) {
        console.error('查询状态日志失败:', err);
        return res.status(500).json({ 
          success: false, 
          message: '查询失败' 
        });
      }

      const logsWithLabels = logs.map(log => ({
        ...log,
        fromStatusLabel: log.from_status ? STATUS_MAP[log.from_status]?.label : null,
        toStatusLabel: STATUS_MAP[log.to_status]?.label || log.to_status
      }));

      res.json({
        success: true,
        data: {
          ...ticket,
          statusLabel: STATUS_MAP[ticket.status]?.label || ticket.status,
          statusColor: STATUS_MAP[ticket.status]?.color || '#909399',
          nextStatuses: getNextStatuses(ticket.status),
          statusLogs: logsWithLabels
        }
      });
    });
  });
});

router.post('/', [
  body('customer_name').trim().notEmpty().withMessage('客户姓名不能为空'),
  body('customer_phone').trim().notEmpty().withMessage('手机号不能为空')
    .custom(validatePhone).withMessage('手机号格式不正确'),
  body('device_model').trim().notEmpty().withMessage('设备型号不能为空'),
  body('fault_description').optional().trim(),
  body('quote_amount').optional().isFloat({ min: 0 }).toFloat().withMessage('报价金额必须是非负数'),
  body('repair_parts').optional().trim(),
  body('estimated_pickup_time').optional().trim(),
  body('notes').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '表单验证失败', 
      errors: errors.array() 
    });
  }

  const {
    customer_name,
    customer_phone,
    device_model,
    fault_description = '',
    quote_amount = 0,
    repair_parts = '',
    estimated_pickup_time = '',
    notes = ''
  } = req.body;

  const ticket_no = generateTicketNo();
  const status = 'pending_inspection';

  db.run(`
    INSERT INTO tickets (
      ticket_no, customer_name, customer_phone, device_model,
      fault_description, quote_amount, repair_parts,
      estimated_pickup_time, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    ticket_no, customer_name, customer_phone, device_model,
    fault_description, quote_amount, repair_parts,
    estimated_pickup_time, notes, status
  ], function(err) {
    if (err) {
      console.error('创建工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '创建失败' 
      });
    }

    const ticketId = this.lastID;

    db.run(`
      INSERT INTO status_logs (ticket_id, from_status, to_status, reason)
      VALUES (?, ?, ?, ?)
    `, [ticketId, null, status, '创建工单'], (logErr) => {
      if (logErr) {
        console.error('记录状态日志失败:', logErr);
      }

      res.json({
        success: true,
        message: '创建成功',
        data: {
          id: ticketId,
          ticket_no,
          status,
          statusLabel: STATUS_MAP[status].label
        }
      });
    });
  });
});

router.put('/:id', [
  param('id').isInt({ min: 1 }).toInt(),
  body('customer_name').optional().trim().notEmpty().withMessage('客户姓名不能为空'),
  body('customer_phone').optional().trim()
    .custom(value => !value || validatePhone(value)).withMessage('手机号格式不正确'),
  body('device_model').optional().trim().notEmpty().withMessage('设备型号不能为空'),
  body('fault_description').optional().trim(),
  body('quote_amount').optional().isFloat({ min: 0 }).toFloat().withMessage('报价金额必须是非负数'),
  body('repair_parts').optional().trim(),
  body('estimated_pickup_time').optional().trim(),
  body('notes').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '表单验证失败', 
      errors: errors.array() 
    });
  }

  const { id } = req.params;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      console.error('查询工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '查询失败' 
      });
    }

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: '工单不存在' 
      });
    }

    if (ticket.status === 'completed' || ticket.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: ticket.status === 'completed' ? '工单已完成，无法修改' : '工单已取消，无法修改'
      });
    }

    const {
      customer_name = ticket.customer_name,
      customer_phone = ticket.customer_phone,
      device_model = ticket.device_model,
      fault_description = ticket.fault_description,
      quote_amount = ticket.quote_amount,
      repair_parts = ticket.repair_parts,
      estimated_pickup_time = ticket.estimated_pickup_time,
      notes = ticket.notes
    } = req.body;

    db.run(`
      UPDATE tickets SET
        customer_name = ?, customer_phone = ?, device_model = ?,
        fault_description = ?, quote_amount = ?, repair_parts = ?,
        estimated_pickup_time = ?, notes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [
      customer_name, customer_phone, device_model,
      fault_description, quote_amount, repair_parts,
      estimated_pickup_time, notes, id
    ], function(err) {
      if (err) {
        console.error('更新工单失败:', err);
        return res.status(500).json({ 
          success: false, 
          message: '更新失败' 
        });
      }

      res.json({
        success: true,
        message: '更新成功'
      });
    });
  });
});

router.post('/:id/transition', [
  param('id').isInt({ min: 1 }).toInt(),
  body('targetStatus').isIn(Object.keys(STATUS_MAP)).withMessage('无效的目标状态'),
  body('reason').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '参数错误', 
      errors: errors.array() 
    });
  }

  const { id } = req.params;
  const { targetStatus, reason } = req.body;

  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      console.error('查询工单失败:', err);
      return res.status(500).json({ 
        success: false, 
        message: '查询失败' 
      });
    }

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: '工单不存在' 
      });
    }

    const disabledReason = getDisabledReason(ticket.status, targetStatus);
    if (disabledReason) {
      return res.status(400).json({ 
        success: false, 
        message: disabledReason
      });
    }

    const transitionReason = reason || getTransitionReason(ticket.status, targetStatus);

    db.run(`
      UPDATE tickets SET
        status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [targetStatus, id], function(err) {
      if (err) {
        console.error('更新工单状态失败:', err);
        return res.status(500).json({ 
          success: false, 
          message: '状态更新失败' 
        });
      }

      db.run(`
        INSERT INTO status_logs (ticket_id, from_status, to_status, reason)
        VALUES (?, ?, ?, ?)
      `, [id, ticket.status, targetStatus, transitionReason], (logErr) => {
        if (logErr) {
          console.error('记录状态日志失败:', logErr);
        }

        res.json({
          success: true,
          message: '状态更新成功',
          data: {
            status: targetStatus,
            statusLabel: STATUS_MAP[targetStatus].label
          }
        });
      });
    });
  });
});

router.get('/status/info', (req, res) => {
  res.json({
    success: true,
    data: STATUS_MAP
  });
});

module.exports = router;
