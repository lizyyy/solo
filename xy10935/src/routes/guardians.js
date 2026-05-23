const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');

router.post('/', async (req, res, next) => {
  try {
    const { student_id, name, relation, phone, id_card, is_primary } = req.body;
    
    if (!student_id || !name || !relation) {
      return res.status(400).json({
        success: false,
        error: { message: '学生ID、接送人姓名、关系不能为空' }
      });
    }
    
    const student = await get('SELECT * FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { message: '学生不存在' }
      });
    }
    
    const existing = await get(
      'SELECT * FROM guardians WHERE student_id = ? AND name = ? AND relation = ?',
      [student_id, name, relation]
    );
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: '该接送人已存在' }
      });
    }
    
    const result = await run(
      `INSERT INTO guardians (student_id, name, relation, phone, id_card, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, name, relation, phone, id_card, is_primary || 0]
    );
    
    const guardian = await get('SELECT * FROM guardians WHERE id = ?', [result.id]);
    
    res.status(201).json({
      success: true,
      data: guardian
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { student_id } = req.query;
    let sql = 'SELECT * FROM guardians WHERE 1=1';
    const params = [];
    
    if (student_id) {
      sql += ' AND student_id = ?';
      params.push(student_id);
    }
    
    const guardians = await all(sql, params);
    
    res.json({
      success: true,
      data: guardians
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const guardian = await get('SELECT * FROM guardians WHERE id = ?', [req.params.id]);
    
    if (!guardian) {
      return res.status(404).json({
        success: false,
        error: { message: '接送人不存在' }
      });
    }
    
    res.json({
      success: true,
      data: guardian
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
