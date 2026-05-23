const { get, prepare } = require('../config/database');
const { logException } = require('../utils/exceptionLogger');
const { 
  PACKAGE_STATUS, 
  canSendReminder, 
  calculateRetentionLevel 
} = require('../utils/business');
const moment = require('moment');

async function createReminder(req, res) {
  try {
    const { package_id, type = 'normal', channel = 'sms', content } = req.body;
    
    if (!package_id) {
      await logException('/api/reminders', 'POST', req.body, 'ValidationError', '缺少package_id');
      return res.status(400).json({ error: '缺少包裹ID' });
    }
    
    const check = await canSendReminder(package_id);
    if (!check.allowed) {
      await logException('/api/reminders', 'POST', req.body, 'DuplicateReminder', check.reason);
      return res.status(400).json({ error: check.reason, deduplicated: true });
    }
    
    const pkg = await get('SELECT * FROM packages WHERE id = ?', [package_id]);
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const stmt = prepare(`
      INSERT INTO reminder_records (package_id, reminder_type, reminder_time, channel, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt.run(package_id, type, now, channel, content || '');
    
    const updateStmt = prepare(`
      UPDATE packages 
      SET reminder_count = reminder_count + 1, last_reminder_time = ?, status = ?, retention_level = ?
      WHERE id = ?
    `);
    await updateStmt.run(now, PACKAGE_STATUS.PENDING_PICKUP, calculateRetentionLevel(pkg.in_time), package_id);
    
    res.status(201).json({
      id: result.lastID,
      package_id,
      reminder_time: now,
      type,
      channel,
      previous_reminder_count: pkg.reminder_count,
      new_reminder_count: pkg.reminder_count + 1
    });
  } catch (error) {
    await logException('/api/reminders', 'POST', req.body, error.name, error.message);
    res.status(500).json({ error: '创建催取记录失败', detail: error.message });
  }
}

async function getReminders(req, res) {
  try {
    const { package_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM reminder_records WHERE 1=1';
    const params = [];
    
    if (package_id) {
      query += ' AND package_id = ?';
      params.push(package_id);
    }
    
    query += ' ORDER BY reminder_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = prepare(query);
    const records = await stmt.all(...params);
    res.json({ data: records });
  } catch (error) {
    await logException('/api/reminders', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '查询催取记录失败', detail: error.message });
  }
}

async function createRejection(req, res) {
  try {
    const { package_id, reason, description, handler } = req.body;
    
    if (!package_id || !reason) {
      await logException('/api/rejections', 'POST', req.body, 'ValidationError', '缺少必填字段');
      return res.status(400).json({ error: '缺少包裹ID或拒收原因' });
    }
    
    const pkg = await get('SELECT * FROM packages WHERE id = ?', [package_id]);
    if (!pkg) {
      await logException('/api/rejections', 'POST', req.body, 'NotFound', '包裹不存在');
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const stmt = prepare(`
      INSERT INTO rejection_records (package_id, reason, description, rejected_at, handler)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await stmt.run(package_id, reason, description || '', now, handler || '');
    
    const updateStmt = prepare('UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    await updateStmt.run(PACKAGE_STATUS.REJECTED, package_id);
    
    res.status(201).json({
      id: result.lastID,
      package_id,
      reason,
      rejected_at: now,
      package_status_updated: true
    });
  } catch (error) {
    await logException('/api/rejections', 'POST', req.body, error.name, error.message);
    res.status(500).json({ error: '创建拒收记录失败', detail: error.message });
  }
}

async function getRejections(req, res) {
  try {
    const { package_id, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM rejection_records WHERE 1=1';
    const params = [];
    
    if (package_id) {
      query += ' AND package_id = ?';
      params.push(package_id);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY rejected_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = prepare(query);
    const records = await stmt.all(...params);
    res.json({ data: records });
  } catch (error) {
    await logException('/api/rejections', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '查询拒收记录失败', detail: error.message });
  }
}

async function createReturnReport(req, res) {
  try {
    const { package_id, rejection_id, return_tracking_number, return_courier, notes } = req.body;
    
    if (!package_id || !rejection_id) {
      await logException('/api/returns', 'POST', req.body, 'ValidationError', '缺少必填字段');
      return res.status(400).json({ error: '缺少包裹ID或拒收记录ID' });
    }
    
    const rejection = await get('SELECT * FROM rejection_records WHERE id = ?', [rejection_id]);
    if (!rejection) {
      await logException('/api/returns', 'POST', req.body, 'NotFound', '拒收记录不存在');
      return res.status(404).json({ error: '拒收记录不存在' });
    }
    
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const stmt = prepare(`
      INSERT INTO return_reports (package_id, rejection_id, return_tracking_number, return_courier, return_time, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = await stmt.run(package_id, rejection_id, return_tracking_number || '', return_courier || '', now, notes || '');
    
    const updatePkgStmt = prepare('UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    await updatePkgStmt.run(PACKAGE_STATUS.PENDING_RETURN, package_id);
    
    const updateRejStmt = prepare('UPDATE rejection_records SET status = ? WHERE id = ?');
    await updateRejStmt.run('processing_return', rejection_id);
    
    res.status(201).json({
      id: result.lastID,
      package_id,
      rejection_id,
      return_time: now,
      return_tracking_number,
      package_status_updated: true
    });
  } catch (error) {
    await logException('/api/returns', 'POST', req.body, error.name, error.message);
    res.status(500).json({ error: '创建退回报告失败', detail: error.message });
  }
}

async function confirmReturn(req, res) {
  try {
    const { id } = req.params;
    const { confirmed_by } = req.body;
    
    const report = await get('SELECT * FROM return_reports WHERE id = ?', [id]);
    if (!report) {
      await logException(`/api/returns/${id}/confirm`, 'PUT', req.body, 'NotFound', '退回报告不存在');
      return res.status(404).json({ error: '退回报告不存在' });
    }
    
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const updateReportStmt = prepare(`
      UPDATE return_reports 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?
      WHERE id = ?
    `);
    await updateReportStmt.run(confirmed_by || '', now, id);
    
    const updatePkgStmt = prepare('UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    await updatePkgStmt.run(PACKAGE_STATUS.RETURNED, report.package_id);
    
    const updateRejStmt = prepare('UPDATE rejection_records SET status = ? WHERE id = ?');
    await updateRejStmt.run('return_completed', report.rejection_id);
    
    res.json({
      success: true,
      return_id: id,
      confirmed_at: now,
      package_status: PACKAGE_STATUS.RETURNED
    });
  } catch (error) {
    await logException(`/api/returns/${req.params.id}/confirm`, 'PUT', req.body, error.name, error.message);
    res.status(500).json({ error: '确认退回失败', detail: error.message });
  }
}

async function getReturnReports(req, res) {
  try {
    const { package_id, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM return_reports WHERE 1=1';
    const params = [];
    
    if (package_id) {
      query += ' AND package_id = ?';
      params.push(package_id);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = prepare(query);
    const records = await stmt.all(...params);
    res.json({ data: records });
  } catch (error) {
    await logException('/api/returns', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '查询退回报告失败', detail: error.message });
  }
}

module.exports = {
  createReminder,
  getReminders,
  createRejection,
  getRejections,
  createReturnReport,
  confirmReturn,
  getReturnReports
};
