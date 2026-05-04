const express = require('express');
const router = express.Router();
const db = require('../database');
const utils = require('../utils');

router.get('/', (req, res, next) => {
  try {
    const groups = db.prepare(`
      SELECT pg.*,
             (SELECT COUNT(*) FROM students s WHERE s.project_group_id = pg.id) as student_count,
             (SELECT COUNT(*) FROM devices d WHERE d.project_group_id = pg.id) as device_count
      FROM project_groups pg
      ORDER BY pg.created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: groups,
      count: groups.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    const group = db.prepare(`
      SELECT pg.*,
             (SELECT COUNT(*) FROM students s WHERE s.project_group_id = pg.id) as student_count,
             (SELECT COUNT(*) FROM devices d WHERE d.project_group_id = pg.id) as device_count
      FROM project_groups pg
      WHERE pg.id = ?
    `).get(parseInt(id));
    
    if (!group) {
      const err = new Error('项目组不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const students = db.prepare(`
      SELECT s.*
      FROM students s
      WHERE s.project_group_id = ?
      ORDER BY s.name
    `).all(parseInt(id));
    
    const devices = db.prepare(`
      SELECT d.*,
             (SELECT COUNT(*) FROM borrow_records br WHERE br.device_id = d.id AND br.status = 'active') as is_borrowed
      FROM devices d
      WHERE d.project_group_id = ?
      ORDER BY d.device_id
    `).all(parseInt(id));
    
    const activeBorrows = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             s.name as student_name,
             s.student_id as student_number
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      WHERE br.project_group_id = ? AND br.status = 'active'
      ORDER BY br.due_date ASC
    `).all(parseInt(id));
    
    const enrichedBorrows = activeBorrows.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      return {
        ...record,
        overdue_days: overdueDays,
        risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      };
    });
    
    const overdueCount = enrichedBorrows.filter(b => b.overdue_days > 0).length;
    
    res.json({
      success: true,
      data: {
        ...group,
        students,
        devices,
        activeBorrows: enrichedBorrows,
        overdueCount,
        stats: {
          totalDevices: devices.length,
          availableDevices: devices.filter(d => d.status === 'available' && !d.is_borrowed).length,
          borrowedDevices: enrichedBorrows.length,
          overdueDevices: overdueCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      const err = new Error('项目组名称为必填项');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const result = db.prepare(`
      INSERT INTO project_groups (name, description)
      VALUES (?, ?)
    `).run(name, description || null);
    
    const newGroup = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '项目组创建成功',
      data: newGroup
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const existing = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(parseInt(id));
    if (!existing) {
      const err = new Error('项目组不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    if (updateFields.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新的字段',
        data: existing
      });
    }
    
    updateValues.push(parseInt(id));
    
    const sql = `UPDATE project_groups SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...updateValues);
    
    const updatedGroup = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(parseInt(id));
    
    res.json({
      success: true,
      message: '项目组信息更新成功',
      data: updatedGroup
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    const group = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(parseInt(id));
    if (!group) {
      const err = new Error('项目组不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const hasStudents = db.prepare('SELECT COUNT(*) as count FROM students WHERE project_group_id = ?').get(parseInt(id)).count > 0;
    const hasDevices = db.prepare('SELECT COUNT(*) as count FROM devices WHERE project_group_id = ?').get(parseInt(id)).count > 0;
    const hasBorrows = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE project_group_id = ? AND status = "active"').get(parseInt(id)).count > 0;
    
    if (hasStudents || hasDevices || hasBorrows) {
      const err = new Error('项目组下仍有学生、设备或活跃借用记录，无法删除');
      err.name = 'ValidationError';
      return next(err);
    }
    
    db.prepare('DELETE FROM project_groups WHERE id = ?').run(parseInt(id));
    
    res.json({
      success: true,
      message: '项目组删除成功'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/borrowed', (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'active' } = req.query;
    
    const group = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(parseInt(id));
    if (!group) {
      const err = new Error('项目组不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      WHERE br.project_group_id = ?
    `;
    const params = [parseInt(id)];
    
    if (status && status !== 'all') {
      sql += ' AND br.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY br.borrow_date DESC';
    
    const records = db.prepare(sql).all(...params);
    
    const enrichedRecords = records.map(record => {
      const overdueDays = record.status === 'active' ? utils.calculateOverdueDays(record.due_date) : 0;
      const riskLevel = record.status === 'active' 
        ? utils.calculateRiskLevel(overdueDays) 
        : record.risk_level;
      
      return {
        ...record,
        overdue_days: overdueDays,
        risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      };
    });
    
    res.json({
      success: true,
      data: {
        group: group.name,
        records: enrichedRecords,
        stats: {
          total: enrichedRecords.length,
          overdue: enrichedRecords.filter(r => r.overdue_days > 0).length,
          risk_level_1: enrichedRecords.filter(r => r.risk_level === 1).length,
          risk_level_2: enrichedRecords.filter(r => r.risk_level === 2).length,
          risk_level_3: enrichedRecords.filter(r => r.risk_level === 3).length,
          risk_level_4: enrichedRecords.filter(r => r.risk_level === 4).length
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
