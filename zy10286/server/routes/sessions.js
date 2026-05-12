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
    const { class_id } = req.query;
    let whereClause = '';
    let params = [];
    
    if (class_id) {
      whereClause = 'WHERE s.class_id = ?';
      params.push(class_id);
    }
    
    const sessions = await allAsync(req.db, `
      SELECT s.*, c.name as class_name, c.course_name
      FROM live_sessions s
      JOIN classes c ON s.class_id = c.id
      ${whereClause}
      ORDER BY s.session_date DESC, s.start_time DESC
    `, params);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const session = await getAsync(req.db, `
      SELECT s.*, c.name as class_name, c.course_name
      FROM live_sessions s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = ?
    `, [req.params.id]);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const permissions = await allAsync(req.db, `
      SELECT p.*, st.name as student_name
      FROM replay_permissions p
      JOIN students st ON p.student_id = st.id
      WHERE p.session_id = ?
    `, [req.params.id]);
    
    res.json({ ...session, permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { class_id, title, session_date, start_time, end_time, replay_url, replay_expiry_date } = req.body;
    const id = uuidv4();
    
    await runAsync(req.db,
      `INSERT INTO live_sessions 
       (id, class_id, title, session_date, start_time, end_time, replay_url, replay_expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, class_id, title, session_date, start_time, end_time, replay_url, replay_expiry_date]
    );

    await req.permissionService.recordEvent(
      'session_created', 'session', id,
      `创建直播场次: ${title}`
    );

    const newSession = await getAsync(req.db, 'SELECT * FROM live_sessions WHERE id = ?', [id]);
    res.status(201).json(newSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, session_date, start_time, end_time, replay_url, replay_expiry_date, status } = req.body;
    const oldSession = await getAsync(req.db, 'SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    
    if (!oldSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await runAsync(req.db,
      `UPDATE live_sessions 
       SET title = ?, session_date = ?, start_time = ?, end_time = ?, 
           replay_url = ?, replay_expiry_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, session_date, start_time, end_time, replay_url, replay_expiry_date, status, req.params.id]
    );

    await req.permissionService.recordEvent(
      'session_updated', 'session', req.params.id,
      `更新直播场次: ${title}`
    );

    const updatedSession = await getAsync(req.db, 'SELECT * FROM live_sessions WHERE id = ?', [req.params.id]);
    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
