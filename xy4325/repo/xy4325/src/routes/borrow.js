const express = require('express');
const router = express.Router();
const db = require('../database');
const utils = require('../utils');

router.post('/borrow', (req, res, next) => {
  try {
    const { device_id, student_id, borrow_days } = req.body;
    
    if (!device_id || !student_id) {
      const err = new Error('设备ID和学生ID为必填项');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const device = db.prepare(`
      SELECT d.*, pg.name as project_group_name
      FROM devices d
      LEFT JOIN project_groups pg ON d.project_group_id = pg.id
      WHERE d.id = ?
    `).get(parseInt(device_id));
    
    if (!device) {
      const err = new Error('设备不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    if (device.status !== 'available') {
      const err = new Error(`设备当前状态为 "${device.status}"，无法借用`);
      err.name = 'ValidationError';
      return next(err);
    }
    
    let student = db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(student_id));
    if (!student) {
      student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(student_id);
    }
    
    if (!student) {
      const err = new Error('学生不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const borrowDate = new Date();
    const dueDate = utils.getDueDate(borrowDate, borrow_days);
    
    const transaction = db.transaction(() => {
      const insertResult = db.prepare(`
        INSERT INTO borrow_records (device_id, student_id, borrow_date, due_date, status, risk_level, project_group_id)
        VALUES (?, ?, ?, ?, 'active', 0, ?)
      `).run(
        device.id,
        student.id,
        utils.formatDateTime(borrowDate),
        utils.formatDateTime(dueDate),
        device.project_group_id
      );
      
      db.prepare(`
        UPDATE devices SET status = 'borrowed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(device.id);
      
      return insertResult.lastInsertRowid;
    });
    
    const recordId = transaction();
    
    const record = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.id = ?
    `).get(recordId);
    
    res.status(201).json({
      success: true,
      message: '设备借用成功',
      data: {
        ...record,
        risk_level_description: utils.getRiskLevelDescription(record.risk_level)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/return/:recordId', (req, res, next) => {
  try {
    const { recordId } = req.params;
    
    const record = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             s.name as student_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      WHERE br.id = ?
    `).get(parseInt(recordId));
    
    if (!record) {
      const err = new Error('借用记录不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    if (record.status !== 'active') {
      const err = new Error('该记录已归还或已取消');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const returnDate = new Date();
    const overdueDays = utils.calculateOverdueDays(record.due_date, returnDate);
    const riskLevel = utils.calculateRiskLevel(overdueDays);
    
    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE borrow_records 
        SET status = 'returned', 
            return_date = ?, 
            risk_level = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(utils.formatDateTime(returnDate), riskLevel, parseInt(recordId));
      
      db.prepare(`
        UPDATE devices SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(record.device_id);
    });
    
    transaction();
    
    const updatedRecord = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             s.name as student_name,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.id = ?
    `).get(parseInt(recordId));
    
    res.json({
      success: true,
      message: overdueDays > 0 
        ? `设备归还成功，超期 ${overdueDays} 天` 
        : '设备归还成功',
      data: {
        ...updatedRecord,
        overdue_days: overdueDays,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/active', (req, res, next) => {
  try {
    const { student_id, project_group_id } = req.query;
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.status = 'active'
    `;
    const params = [];
    
    if (student_id) {
      sql += ' AND br.student_id = ?';
      params.push(parseInt(student_id));
    }
    
    if (project_group_id) {
      sql += ' AND br.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    sql += ' ORDER BY br.due_date ASC';
    
    const records = db.prepare(sql).all(...params);
    
    const enrichedRecords = records.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      if (riskLevel !== record.risk_level) {
        db.prepare('UPDATE borrow_records SET risk_level = ? WHERE id = ?').run(riskLevel, record.id);
      }
      
      return {
        ...record,
        overdue_days: overdueDays,
        current_risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      };
    });
    
    res.json({
      success: true,
      data: enrichedRecords,
      count: enrichedRecords.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/history', (req, res, next) => {
  try {
    const { student_id, device_id, project_group_id, status, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];
    
    if (student_id) {
      sql += ' AND br.student_id = ?';
      params.push(parseInt(student_id));
      countParams.push(parseInt(student_id));
    }
    
    if (device_id) {
      sql += ' AND br.device_id = ?';
      params.push(parseInt(device_id));
      countParams.push(parseInt(device_id));
    }
    
    if (project_group_id) {
      sql += ' AND br.project_group_id = ?';
      params.push(parseInt(project_group_id));
      countParams.push(parseInt(project_group_id));
    }
    
    if (status) {
      sql += ' AND br.status = ?';
      params.push(status);
      countParams.push(status);
    }
    
    const countSql = sql.replace('SELECT br.*,', 'SELECT COUNT(*) as total');
    const totalResult = db.prepare(countSql).get(...countParams);
    const total = totalResult ? totalResult.total : 0;
    
    sql += ' ORDER BY br.borrow_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const records = db.prepare(sql).all(...params);
    
    const enrichedRecords = records.map(record => {
      const overdueDays = record.status === 'active' ? utils.calculateOverdueDays(record.due_date) : 0;
      const riskLevel = record.status === 'active' 
        ? utils.calculateRiskLevel(overdueDays) 
        : record.risk_level;
      
      return {
        ...record,
        overdue_days: overdueDays,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      };
    });
    
    res.json({
      success: true,
      data: enrichedRecords,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: enrichedRecords.length
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:recordId', (req, res, next) => {
  try {
    const { recordId } = req.params;
    
    const record = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             d.model as device_model,
             s.name as student_name,
             s.student_id as student_number,
             s.email as student_email,
             s.phone as student_phone,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.id = ?
    `).get(parseInt(recordId));
    
    if (!record) {
      const err = new Error('借用记录不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const overdueDays = record.status === 'active' ? utils.calculateOverdueDays(record.due_date) : 0;
    const riskLevel = record.status === 'active' 
      ? utils.calculateRiskLevel(overdueDays) 
      : record.risk_level;
    
    res.json({
      success: true,
      data: {
        ...record,
        overdue_days: overdueDays,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
