const { generateId } = require('./db');
const { validateLog, maskPrivacy, detectDuplicate } = require('./validation');

function setupRoutes(app, db) {

  app.get('/api/patients', (req, res) => {
    const patients = db.prepare('SELECT * FROM patients WHERE is_deleted = 0').all();
    res.json(patients.map(p => maskPrivacy(p)));
  });

  app.post('/api/patients', (req, res) => {
    const { id, name, age, diagnosis, contact_info } = req.body;
    const existing = id ? db.prepare('SELECT * FROM patients WHERE id = ?').get(id) : null;
    
    if (existing) {
      const newVersion = existing.version + 1;
      db.prepare(`
        INSERT INTO patients (id, name, age, diagnosis, contact_info, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, age, diagnosis, contact_info, newVersion);
      res.json({ id, version: newVersion, message: '已创建新版本，未覆盖原数据' });
    } else {
      const newId = id || generateId('patient');
      db.prepare(`
        INSERT INTO patients (id, name, age, diagnosis, contact_info)
        VALUES (?, ?, ?, ?, ?)
      `).run(newId, name, age, diagnosis, contact_info);
      res.json({ id: newId, version: 1 });
    }
  });

  app.get('/api/tracks', (req, res) => {
    const tracks = db.prepare('SELECT * FROM tracks WHERE is_deleted = 0').all();
    res.json(tracks);
  });

  app.post('/api/tracks', (req, res) => {
    const { id, name, artist, genre, duration } = req.body;
    const existing = id ? db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) : null;
    
    const duplicate = detectDuplicate(db, 'tracks', { name, artist });
    if (duplicate) {
      return res.status(400).json({
        error: '曲目重复',
        duplicate: duplicate,
        message: '检测到同名同作者曲目，请确认是否为同一首'
      });
    }
    
    if (existing) {
      const newVersion = existing.version + 1;
      db.prepare(`
        INSERT INTO tracks (id, name, artist, genre, duration, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, artist, genre, duration, newVersion);
      res.json({ id, version: newVersion, message: '已创建新版本' });
    } else {
      const newId = id || generateId('track');
      db.prepare(`
        INSERT INTO tracks (id, name, artist, genre, duration)
        VALUES (?, ?, ?, ?, ?)
      `).run(newId, name, artist, genre, duration);
      res.json({ id: newId, version: 1 });
    }
  });

  app.get('/api/emotion-scales', (req, res) => {
    const scales = db.prepare('SELECT * FROM emotion_scales').all();
    res.json(scales);
  });

  app.get('/api/logs', (req, res) => {
    const { patient_id, start_date, end_date } = req.query;
    let sql = `
      SELECT l.*, p.name as patient_name
      FROM logs l
      JOIN patients p ON l.patient_id = p.id
      WHERE l.is_deleted = 0
    `;
    const params = [];
    
    if (patient_id) {
      sql += ' AND l.patient_id = ?';
      params.push(patient_id);
    }
    if (start_date) {
      sql += ' AND l.session_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND l.session_date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY l.session_date DESC, l.created_at DESC';
    
    const logs = db.prepare(sql).all(...params);
    
    const logsWithDetails = logs.map(log => {
      const emotions = db.prepare(`
        SELECT e.*, s.name as scale_name
        FROM log_emotions e
        JOIN emotion_scales s ON e.scale_id = s.id
        WHERE e.log_id = ?
      `).all(log.id);
      
      const tracks = db.prepare(`
        SELECT t.*, lt.order_index, lt.notes as track_notes
        FROM log_tracks lt
        JOIN tracks t ON lt.track_id = t.id
        WHERE lt.log_id = ?
        ORDER BY lt.order_index
      `).all(log.id);
      
      return { ...maskPrivacy(log), emotions, tracks };
    });
    
    res.json(logsWithDetails);
  });

  app.post('/api/logs', (req, res) => {
    const { id, patient_id, session_date, session_time, time_point, 
            therapist_notes, reaction_snippets, created_by, emotions, 
            tracks, submission_type = 'normal' } = req.body;

    const validation = validateLog(req.body, db);
    if (!validation.valid) {
      validation.warnings.forEach(w => {
        db.prepare(`
          INSERT INTO warnings (id, log_id, type, message, severity)
          VALUES (?, ?, ?, ?, ?)
        `).run(generateId('warn'), id, w.type, w.message, w.severity);
      });
    }

    const existing = id ? db.prepare('SELECT * FROM logs WHERE id = ?').get(id) : null;
    
    let logId, version;
    
    if (existing) {
      version = existing.version + 1;
      logId = id;
      db.prepare(`
        INSERT INTO logs (id, patient_id, session_date, session_time, time_point,
                          therapist_notes, reaction_snippets, created_by, version, submission_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(logId, patient_id, session_date, session_time, time_point,
             therapist_notes, reaction_snippets, created_by, version, submission_type);
    } else {
      logId = id || generateId('log');
      version = 1;
      db.prepare(`
        INSERT INTO logs (id, patient_id, session_date, session_time, time_point,
                          therapist_notes, reaction_snippets, created_by, version, submission_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(logId, patient_id, session_date, session_time, time_point,
             therapist_notes, reaction_snippets, created_by, version, submission_type);
    }

    if (emotions && emotions.length > 0) {
      const insertEmotion = db.prepare(`
        INSERT INTO log_emotions (id, log_id, scale_id, value)
        VALUES (?, ?, ?, ?)
      `);
      emotions.forEach(e => {
        insertEmotion.run(generateId('emo'), logId, e.scale_id, e.value);
      });
    }

    if (tracks && tracks.length > 0) {
      const insertTrack = db.prepare(`
        INSERT INTO log_tracks (id, log_id, track_id, order_index, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      tracks.forEach((t, idx) => {
        insertTrack.run(generateId('lt'), logId, t.track_id, idx, t.notes);
      });
    }

    res.json({ 
      id: logId, 
      version, 
      warnings: validation.warnings,
      message: existing ? '已创建新版本记录' : '记录已保存'
    });
  });

  app.post('/api/logs/:id/withdraw', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    db.prepare(`
      UPDATE logs SET is_withdrawn = 1, withdrawal_reason = ?
      WHERE id = ?
    `).run(reason, id);
    
    res.json({ success: true, message: '记录已撤回' });
  });

  app.get('/api/warnings', (req, res) => {
    const warnings = db.prepare(`
      SELECT w.*, l.session_date, p.name as patient_name
      FROM warnings w
      LEFT JOIN logs l ON w.log_id = l.id
      LEFT JOIN patients p ON l.patient_id = p.id
      WHERE w.resolved = 0
      ORDER BY w.created_at DESC
    `).all();
    res.json(warnings.map(w => maskPrivacy(w)));
  });

  app.post('/api/warnings/:id/resolve', (req, res) => {
    db.prepare('UPDATE warnings SET resolved = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/reports/monthly', (req, res) => {
    const { patient_id, year, month } = req.query;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const logs = db.prepare(`
      SELECT l.*, p.name as patient_name
      FROM logs l
      JOIN patients p ON l.patient_id = p.id
      WHERE l.patient_id = ? AND l.session_date >= ? AND l.session_date <= ?
        AND l.is_deleted = 0 AND l.is_withdrawn = 0
      ORDER BY l.session_date ASC
    `).all(patient_id, startDate, endDate);
    
    const logsWithDetails = logs.map(log => {
      const emotions = db.prepare(`
        SELECT e.*, s.name as scale_name
        FROM log_emotions e
        JOIN emotion_scales s ON e.scale_id = s.id
        WHERE e.log_id = ?
      `).all(log.id);
      
      const tracks = db.prepare(`
        SELECT t.name, t.artist, lt.order_index
        FROM log_tracks lt
        JOIN tracks t ON lt.track_id = t.id
        WHERE lt.log_id = ?
        ORDER BY lt.order_index
      `).all(log.id);
      
      return { ...maskPrivacy(log), emotions, tracks };
    });
    
    res.json({
      patient: maskPrivacy(db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id)),
      period: { year, month },
      logs: logsWithDetails,
      total_sessions: logsWithDetails.length
    });
  });

  app.get('/api/trends', (req, res) => {
    const { patient_id, start_date, end_date } = req.query;
    
    const logs = db.prepare(`
      SELECT l.id, l.session_date
      FROM logs l
      WHERE l.patient_id = ? AND l.session_date >= ? AND l.session_date <= ?
        AND l.is_deleted = 0 AND l.is_withdrawn = 0
      ORDER BY l.session_date ASC
    `).all(patient_id, start_date, end_date);
    
    const trendData = logs.map(log => {
      const emotions = db.prepare(`
        SELECT e.scale_id, e.value, s.name
        FROM log_emotions e
        JOIN emotion_scales s ON e.scale_id = s.id
        WHERE e.log_id = ?
      `).all(log.id);
      
      return {
        date: log.session_date,
        emotions: emotions.reduce((acc, e) => {
          acc[e.name] = e.value;
          return acc;
        }, {})
      };
    });
    
    res.json(trendData);
  });
}

module.exports = { setupRoutes };
