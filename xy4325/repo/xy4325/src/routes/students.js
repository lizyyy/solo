const express = require('express');
const router = express.Router();
const db = require('../database');
const utils = require('../utils');

router.get('/', (req, res, next) => {
  try {
    const { project_group_id, name, student_id } = req.query;
    
    let sql = `
      SELECT s.*,
             pg.name as project_group_name,
             (SELECT COUNT(*) FROM borrow_records br WHERE br.student_id = s.id AND br.status = 'active') as active_borrow_count
      FROM students s
      LEFT JOIN project_groups pg ON s.project_group_id = pg.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_group_id) {
      sql += ' AND s.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    if (name) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${name}%`);
    }
    
    if (student_id) {
      sql += ' AND s.student_id LIKE ?';
      params.push(`%${student_id}%`);
    }
    
    sql += ' ORDER BY s.created_at DESC';
    
    const students = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: students,
      count: students.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    let student = db.prepare(`
      SELECT s.*,
             pg.name as project_group_name
      FROM students s
      LEFT JOIN project_groups pg ON s.project_group_id = pg.id
      WHERE s.id = ?
    `).get(parseInt(id));
    
    if (!student) {
      student = db.prepare(`
        SELECT s.*,
               pg.name as project_group_name
        FROM students s
        LEFT JOIN project_groups pg ON s.project_group_id = pg.id
        WHERE s.student_id = ?
      `).get(id);
    }
    
    if (!student) {
      const err = new Error('学生不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const borrowHistory = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.student_id = ?
      ORDER BY br.borrow_date DESC
      LIMIT 50
    `).all(student.id);
    
    const activeBorrows = borrowHistory.filter(b => b.status === 'active').map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
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
        ...student,
        activeBorrows,
        borrowHistory,
        stats: {
          totalBorrows: borrowHistory.length,
          activeBorrows: activeBorrows.length,
          overdueBorrows: activeBorrows.filter(b => b.overdue_days > 0).length
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { student_id, name, email, phone, project_group_id } = req.body;
    
    if (!student_id || !name) {
      const err = new Error('学号和姓名为必填项');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const result = db.prepare(`
      INSERT INTO students (student_id, name, email, phone, project_group_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(student_id, name, email || null, phone || null, project_group_id || null);
    
    const newStudent = db.prepare(`
      SELECT s.*, pg.name as project_group_name
      FROM students s
      LEFT JOIN project_groups pg ON s.project_group_id = pg.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '学生登记成功',
      data: newStudent
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, project_group_id } = req.body;
    
    let student = db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(id));
    if (!student) {
      student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(id);
    }
    
    if (!student) {
      const err = new Error('学生不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (project_group_id !== undefined) {
      updateFields.push('project_group_id = ?');
      updateValues.push(project_group_id);
    }
    
    if (updateFields.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新的字段',
        data: student
      });
    }
    
    updateValues.push(student.id);
    
    const sql = `UPDATE students SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...updateValues);
    
    const updatedStudent = db.prepare(`
      SELECT s.*, pg.name as project_group_name
      FROM students s
      LEFT JOIN project_groups pg ON s.project_group_id = pg.id
      WHERE s.id = ?
    `).get(student.id);
    
    res.json({
      success: true,
      message: '学生信息更新成功',
      data: updatedStudent
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    let student = db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(id));
    if (!student) {
      student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(id);
    }
    
    if (!student) {
      const err = new Error('学生不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const activeBorrows = db.prepare(`
      SELECT COUNT(*) as count FROM borrow_records WHERE student_id = ? AND status = 'active'
    `).get(student.id);
    
    if (activeBorrows.count > 0) {
      const err = new Error(`学生当前有 ${activeBorrows.count} 个活跃的借用记录，无法删除`);
      err.name = 'ValidationError';
      return next(err);
    }
    
    db.prepare('DELETE FROM students WHERE id = ?').run(student.id);
    
    res.json({
      success: true,
      message: '学生删除成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', (req, res, next) => {
  try {
    const { students } = req.body;
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      const err = new Error('请提供学生列表');
      err.name = 'ValidationError';
      return next(err);
    }
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    const transaction = db.transaction(() => {
      for (const student of students) {
        try {
          const { student_id, name, email, phone, project_group_id } = student;
          
          if (!student_id || !name) {
            failCount++;
            errors.push({
              student,
              reason: '缺少学号或姓名'
            });
            continue;
          }
          
          db.prepare(`
            INSERT INTO students (student_id, name, email, phone, project_group_id)
            VALUES (?, ?, ?, ?, ?)
          `).run(student_id, name, email || null, phone || null, project_group_id || null);
          
          successCount++;
        } catch (err) {
          failCount++;
          errors.push({
            student,
            reason: err.message
          });
        }
      }
    });
    
    transaction();
    
    res.json({
      success: true,
      message: `批量导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      data: {
        successCount,
        failCount,
        errors: errors.slice(0, 20)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
