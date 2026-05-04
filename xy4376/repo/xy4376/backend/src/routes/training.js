import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDB();
  const sessions = db.prepare(`
    SELECT id, name, description, created_at, updated_at
    FROM training_sessions
    ORDER BY created_at DESC
  `).all();
  
  res.json(sessions);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const session = db.prepare(`
    SELECT * FROM training_sessions WHERE id = ?
  `).get(req.params.id);
  
  if (!session) {
    return res.status(404).json({ error: '训练场次不存在' });
  }
  
  const result = {
    ...session,
    venue_geojson: session.venue_geojson ? JSON.parse(session.venue_geojson) : null,
    fan_window_data: session.fan_window_data ? JSON.parse(session.fan_window_data) : null,
    sensor_data: session.sensor_data ? JSON.parse(session.sensor_data) : null
  };
  
  res.json(result);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { name, description, venue_geojson, fan_window_data, sensor_data } = req.body;
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO training_sessions (id, name, description, created_at, updated_at, venue_geojson, fan_window_data, sensor_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name || '未命名训练',
    description || '',
    now,
    now,
    venue_geojson ? JSON.stringify(venue_geojson) : null,
    fan_window_data ? JSON.stringify(fan_window_data) : null,
    sensor_data ? JSON.stringify(sensor_data) : null
  );
  
  const newSession = db.prepare(`SELECT * FROM training_sessions WHERE id = ?`).get(id);
  
  res.status(201).json({
    ...newSession,
    venue_geojson: newSession.venue_geojson ? JSON.parse(newSession.venue_geojson) : null,
    fan_window_data: newSession.fan_window_data ? JSON.parse(newSession.fan_window_data) : null,
    sensor_data: newSession.sensor_data ? JSON.parse(newSession.sensor_data) : null
  });
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const { name, description, venue_geojson, fan_window_data, sensor_data } = req.body;
  
  const existing = db.prepare(`SELECT id FROM training_sessions WHERE id = ?`).get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '训练场次不存在' });
  }
  
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE training_sessions 
    SET name = ?, description = ?, updated_at = ?, venue_geojson = ?, fan_window_data = ?, sensor_data = ?
    WHERE id = ?
  `).run(
    name || '未命名训练',
    description || '',
    now,
    venue_geojson ? JSON.stringify(venue_geojson) : null,
    fan_window_data ? JSON.stringify(fan_window_data) : null,
    sensor_data ? JSON.stringify(sensor_data) : null,
    req.params.id
  );
  
  const updated = db.prepare(`SELECT * FROM training_sessions WHERE id = ?`).get(req.params.id);
  
  res.json({
    ...updated,
    venue_geojson: updated.venue_geojson ? JSON.parse(updated.venue_geojson) : null,
    fan_window_data: updated.fan_window_data ? JSON.parse(updated.fan_window_data) : null,
    sensor_data: updated.sensor_data ? JSON.parse(updated.sensor_data) : null
  });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  
  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM review_notes WHERE session_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM identified_issues WHERE session_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM sensor_points WHERE session_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM risk_results WHERE session_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM export_audit WHERE session_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM training_sessions WHERE id = ?`).run(req.params.id);
  });
  
  transaction();
  
  res.json({ success: true, message: '训练场次已删除' });
});

export default router;
