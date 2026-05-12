const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

router.get('/', async (req, res) => {
  try {
    const classes = await allAsync(req.db, `
      SELECT c.*, 
        COUNT(DISTINCT e.student_id) as student_count,
        COUNT(DISTINCT s.id) as session_count
      FROM classes c
      LEFT JOIN class_enrollments e ON c.id = e.class_id AND e.status = 'active'
      LEFT JOIN live_sessions s ON c.id = s.class_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const classData = await getAsync(req.db, 'SELECT * FROM classes WHERE id = ?', [req.params.id]);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, course_name, start_date, end_date } = req.body;
    const id = uuidv4();
    
    await runAsync(req.db,
      `INSERT INTO classes (id, name, course_name, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, course_name, start_date, end_date]
    );

    await req.permissionService.recordEvent(
      'class_created', 'class', id,
      `创建班级: ${name} - ${course_name}`
    );

    const newClass = await getAsync(req.db, 'SELECT * FROM classes WHERE id = ?', [id]);
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, course_name, start_date, end_date, status } = req.body;
    const oldClass = await getAsync(req.db, 'SELECT * FROM classes WHERE id = ?', [req.params.id]);
    
    if (!oldClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    await runAsync(req.db,
      `UPDATE classes 
       SET name = ?, course_name = ?, start_date = ?, end_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, course_name, start_date, end_date, status, req.params.id]
    );

    await req.permissionService.recordEvent(
      'class_updated', 'class', req.params.id,
      `更新班级信息`,
      oldClass, { ...oldClass, name, course_name, start_date, end_date, status }
    );

    const updatedClass = await getAsync(req.db, 'SELECT * FROM classes WHERE id = ?', [req.params.id]);
    res.json(updatedClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
