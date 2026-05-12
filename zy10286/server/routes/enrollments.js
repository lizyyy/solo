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
    const { class_id, student_id } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (class_id) {
      whereClause += ' AND e.class_id = ?';
      params.push(class_id);
    }
    if (student_id) {
      whereClause += ' AND e.student_id = ?';
      params.push(student_id);
    }
    
    const enrollments = await allAsync(req.db, `
      SELECT e.*, 
        s.name as student_name, s.phone, s.email,
        c.name as class_name, c.course_name
      FROM class_enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
      ${whereClause}
      ORDER BY e.enrollment_date DESC
    `, params);
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const enrollment = await getAsync(req.db, `
      SELECT e.*, 
        s.name as student_name,
        c.name as class_name, c.course_name
      FROM class_enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = ?
    `, [req.params.id]);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(enrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { class_id, student_id } = req.body;
    
    const existing = await getAsync(req.db,
      `SELECT * FROM class_enrollments 
       WHERE class_id = ? AND student_id = ? AND status = 'active'`,
      [class_id, student_id]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Student is already enrolled in this class' });
    }
    
    const id = uuidv4();
    const enrollment_date = new Date().toISOString();
    
    await runAsync(req.db,
      `INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date)
       VALUES (?, ?, ?, ?)`,
      [id, class_id, student_id, enrollment_date]
    );

    await req.permissionService.recordEvent(
      'student_enrolled', 'enrollment', id,
      `学员加入班级`
    );

    const sessions = await allAsync(req.db,
      `SELECT id FROM live_sessions WHERE class_id = ?`,
      [class_id]
    );
    
    for (const session of sessions) {
      await req.permissionService.grantPermission(id, session.id, 'enrollment');
    }

    const newEnrollment = await getAsync(req.db, `
      SELECT e.*, s.name as student_name, c.name as class_name
      FROM class_enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = ?
    `, [id]);
    
    res.status(201).json(newEnrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/refund', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await req.permissionService.processRefund(req.params.id, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    const { target_class_id, operator } = req.body;
    const result = await req.permissionService.transferStudent(req.params.id, target_class_id, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
