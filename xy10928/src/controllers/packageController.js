const { get, all, prepare } = require('../config/database');
const { logException } = require('../utils/exceptionLogger');
const { 
  PACKAGE_STATUS, 
  calculateRetentionLevel, 
  validateStatusTransition,
  getRetentionHours
} = require('../utils/business');
const moment = require('moment');

async function createPackage(req, res) {
  try {
    const { tracking_number, recipient, courier_company, weight, storage_location, in_time } = req.body;
    
    if (!tracking_number || !recipient?.name || !recipient?.phone) {
      await logException('/api/packages', 'POST', req.body, 'ValidationError', '缺少必填字段');
      return res.status(400).json({ error: '缺少必填字段：运单号、收件人姓名和电话' });
    }

    let recipientId;
    const existingRecipient = await get('SELECT id FROM recipients WHERE phone = ?', [recipient.phone]);
    
    if (existingRecipient) {
      recipientId = existingRecipient.id;
    } else {
      const recipientStmt = prepare('INSERT INTO recipients (name, phone, address) VALUES (?, ?, ?)');
      const result = await recipientStmt.run(recipient.name, recipient.phone, recipient.address || '');
      recipientId = result.lastID;
    }

    const actualInTime = in_time || moment().format('YYYY-MM-DD HH:mm:ss');
    const retentionLevel = calculateRetentionLevel(actualInTime);

    const packageStmt = prepare(`
      INSERT INTO packages 
      (tracking_number, recipient_id, courier_company, weight, storage_location, in_time, retention_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = await packageStmt.run(
      tracking_number, recipientId, courier_company || '', weight || 0, 
      storage_location || '', actualInTime, retentionLevel
    );

    res.status(201).json({
      id: result.lastID,
      tracking_number,
      recipient: { id: recipientId, ...recipient },
      in_time: actualInTime,
      retention_level: retentionLevel
    });
  } catch (error) {
    await logException('/api/packages', 'POST', req.body, error.name, error.message);
    res.status(500).json({ error: '创建包裹失败', detail: error.message });
  }
}

async function getPackages(req, res) {
  try {
    const { status, retention_level, tracking_number, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT p.*, r.name as recipient_name, r.phone as recipient_phone, r.address as recipient_address
      FROM packages p
      JOIN recipients r ON p.recipient_id = r.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (retention_level) {
      query += ' AND p.retention_level = ?';
      params.push(retention_level);
    }
    if (tracking_number) {
      query += ' AND p.tracking_number LIKE ?';
      params.push(`%${tracking_number}%`);
    }
    
    query += ' ORDER BY p.in_time ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const packages = await all(query, params);
    const packagesWithHours = packages.map(pkg => ({
      ...pkg,
      retention_hours: getRetentionHours(pkg.in_time)
    }));
    
    const countResult = await get('SELECT COUNT(*) as total FROM packages');
    const total = countResult.total;
    
    res.json({
      data: packagesWithHours,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    await logException('/api/packages', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '查询包裹失败', detail: error.message });
  }
}

async function getPackageById(req, res) {
  try {
    const { id } = req.params;
    const pkg = await get(`
      SELECT p.*, r.name as recipient_name, r.phone as recipient_phone, r.address as recipient_address
      FROM packages p
      JOIN recipients r ON p.recipient_id = r.id
      WHERE p.id = ?
    `, [id]);
    
    if (!pkg) {
      await logException(`/api/packages/${id}`, 'GET', req.params, 'NotFound', '包裹不存在');
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    pkg.retention_hours = getRetentionHours(pkg.in_time);
    res.json(pkg);
  } catch (error) {
    await logException(`/api/packages/${req.params.id}`, 'GET', req.params, error.name, error.message);
    res.status(500).json({ error: '查询包裹详情失败', detail: error.message });
  }
}

async function updatePackageStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const pkg = await get('SELECT * FROM packages WHERE id = ?', [id]);
    if (!pkg) {
      await logException(`/api/packages/${id}/status`, 'PUT', req.body, 'NotFound', '包裹不存在');
      return res.status(404).json({ error: '包裹不存在' });
    }
    
    if (!validateStatusTransition(pkg.status, status)) {
      await logException(`/api/packages/${id}/status`, 'PUT', req.body, 'InvalidTransition', 
        `不允许从 ${pkg.status} 转换到 ${status}`);
      return res.status(400).json({ error: `不允许从 ${pkg.status} 转换到 ${status}` });
    }
    
    const stmt = prepare('UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    await stmt.run(status, id);
    
    res.json({ success: true, id, new_status: status, previous_status: pkg.status });
  } catch (error) {
    await logException(`/api/packages/${req.params.id}/status`, 'PUT', req.body, error.name, error.message);
    res.status(500).json({ error: '更新包裹状态失败', detail: error.message });
  }
}

async function manualCorrect(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['tracking_number', 'courier_company', 'weight', 'storage_location', 'status', 'in_time'];
    const updateFields = Object.keys(updates).filter(k => allowedFields.includes(k));
    
    if (updateFields.length === 0) {
      await logException(`/api/packages/${id}/correct`, 'PATCH', req.body, 'ValidationError', '无有效更新字段');
      return res.status(400).json({ error: '无有效更新字段' });
    }
    
    const setClause = updateFields.map(f => `${f} = ?`).join(', ');
    const values = updateFields.map(f => updates[f]);
    
    if (updates.in_time) {
      const newLevel = calculateRetentionLevel(updates.in_time);
      const stmt = prepare(`UPDATE packages SET ${setClause}, retention_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      const allValues = [...updateFields.map(f => updates[f]), newLevel, id];
      await stmt.run(...allValues);
    } else {
      const stmt = prepare(`UPDATE packages SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      await stmt.run(...values, id);
    }
    
    res.json({ success: true, corrected_fields: updateFields });
  } catch (error) {
    await logException(`/api/packages/${req.params.id}/correct`, 'PATCH', req.body, error.name, error.message);
    res.status(500).json({ error: '人工修正失败', detail: error.message });
  }
}

module.exports = {
  createPackage,
  getPackages,
  getPackageById,
  updatePackageStatus,
  manualCorrect
};
