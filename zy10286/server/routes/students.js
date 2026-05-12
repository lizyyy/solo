const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  };
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
    const students = await allAsync(req.db, `
      SELECT s.*,
        COUNT(DISTINCT e.id) as enrollment_count,
        COUNT(DISTINCT a.id) as account_count
      FROM students s
      LEFT JOIN class_enrollments e ON s.id = e.student_id
      LEFT JOIN student_accounts a ON s.id = a.student_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const student = await getAsync(req.db, 'SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const accounts = await allAsync(req.db, 'SELECT * FROM student_accounts WHERE student_id = ?', [req.params.id]);
    const enrollments = await allAsync(req.db, `
      SELECT e.*, c.name as class_name, c.course_name
      FROM class_enrollments e
      JOIN classes c ON e.class_id = c.id
      WHERE e.student_id = ?
      ORDER BY e.enrollment_date DESC
    `, [req.params.id]);
    
    res.json({ ...student, accounts, enrollments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, id_card } = req.body;
    const id = uuidv4();
    
    await runAsync(req.db,
      `INSERT INTO students (id, name, phone, email, id_card)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, phone, email, id_card]
    );

    await req.permissionService.recordEvent(
      'student_created', 'student', id,
      `创建学员: ${name}`
    );

    const newStudent = await getAsync(req.db, 'SELECT * FROM students WHERE id = ?', [id]);
    res.status(201).json(newStudent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/accounts', async (req, res) => {
  try {
    const { account_type, account_identifier, is_primary } = req.body;
    const id = uuidv4();
    
    if (is_primary) {
      await runAsync(req.db,
        `UPDATE student_accounts SET is_primary = 0 WHERE student_id = ?`,
        [req.params.id]
      );
    }

    await runAsync(req.db,
      `INSERT INTO student_accounts (id, student_id, account_type, account_identifier, is_primary)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, account_type, account_identifier, is_primary ? 1 : 0]
    );

    const newAccount = await getAsync(req.db, 'SELECT * FROM student_accounts WHERE id = ?', [id]);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
