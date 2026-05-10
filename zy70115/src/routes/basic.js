const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.get('/health', (req, res) => {
  res.json(buildSuccessResponse({ status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常'));
});

router.get('/schools', (req, res) => {
  db.all('SELECT * FROM schools ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.get('/classes', (req, res) => {
  db.all(`
    SELECT c.*, s.name as school_name
    FROM classes c
    JOIN schools s ON c.school_id = s.id
    ORDER BY s.name, c.name
  `, (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.get('/routes', (req, res) => {
  db.all('SELECT * FROM delivery_routes ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.get('/routes/:id/stops', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT rs.*, s.name as school_name
    FROM route_stops rs
    JOIN schools s ON rs.school_id = s.id
    WHERE rs.route_id = ?
    ORDER BY rs.order_no
  `, [id], (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.get('/allergens', (req, res) => {
  db.all(`
    SELECT ar.*, s.name as school_name, c.name as class_name
    FROM allergen_rules ar
    LEFT JOIN schools s ON ar.school_id = s.id
    LEFT JOIN classes c ON ar.class_id = c.id
    WHERE ar.status = 'active'
    ORDER BY ar.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.post('/allergens', (req, res) => {
  const { schoolId, classId, allergenType, description, affectedCount, operator } = req.body;
  
  if (!allergenType) {
    return res.status(400).json(buildErrorResponse('请提供过敏源类型', 400));
  }

  db.run(
    `INSERT INTO allergen_rules (school_id, class_id, allergen_type, description, affected_student_count, status) VALUES (?, ?, ?, ?, ?, 'active')`,
    [schoolId || null, classId || null, allergenType, description || '', affectedCount || 0],
    function(err) {
      if (err) return res.status(500).json(buildErrorResponse('添加失败', 500, err.message));
      res.json(buildSuccessResponse({ id: this.lastID }, '过敏源规则已添加'));
    }
  );
});

module.exports = router;
