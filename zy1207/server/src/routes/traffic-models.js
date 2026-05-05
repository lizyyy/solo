import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 50 } = req.query;
  const offset = (page - 1) * pageSize;
  
  const items = db.prepare(`
    SELECT * FROM traffic_models 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(parseInt(pageSize), parseInt(offset));
  
  const { total } = db.prepare('SELECT COUNT(*) as total FROM traffic_models').get();
  
  res.json({
    data: items,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM traffic_models WHERE id = ?').get(id);
  
  if (!item) {
    return res.status(404).json({ error: '流量模型不存在' });
  }
  
  res.json({ data: item });
});

router.post('/', (req, res) => {
  const { name, description, total_users, ramp_up_time, hold_time, iterations, config_json } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '流量模型名称为必填项' });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  const configStr = config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null;
  
  db.prepare(`
    INSERT INTO traffic_models (id, name, description, total_users, ramp_up_time, hold_time, iterations, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, description, total_users || 0, ramp_up_time || 0, hold_time || 0, iterations || 0, configStr, now, now);
  
  res.json({ data: { id, name, description, total_users, ramp_up_time, hold_time, iterations } });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, total_users, ramp_up_time, hold_time, iterations, config_json } = req.body;
  
  const existing = db.prepare('SELECT * FROM traffic_models WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '流量模型不存在' });
  }
  
  const now = new Date().toISOString();
  const configStr = config_json !== undefined ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : existing.config_json;
  
  db.prepare(`
    UPDATE traffic_models 
    SET name = ?, description = ?, total_users = ?, ramp_up_time = ?, hold_time = ?, iterations = ?, config_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    description ?? existing.description,
    total_users ?? existing.total_users,
    ramp_up_time ?? existing.ramp_up_time,
    hold_time ?? existing.hold_time,
    iterations ?? existing.iterations,
    configStr,
    now,
    id
  );
  
  const updated = db.prepare('SELECT * FROM traffic_models WHERE id = ?').get(id);
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM traffic_models WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '流量模型不存在' });
  }
  
  db.prepare('DELETE FROM traffic_models WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

export default router;
