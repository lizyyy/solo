import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 50, status, priority, batch_id } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `
    SELECT t.*, ai.name as interface_name, tb.name as batch_name
    FROM tasks t
    LEFT JOIN api_interfaces ai ON t.related_interface_id = ai.id
    LEFT JOIN test_batches tb ON t.batch_id = tb.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  
  if (batch_id) {
    query += ' AND t.batch_id = ?';
    params.push(batch_id);
  }
  
  query += ' ORDER BY t.priority = "high" DESC, t.priority = "medium" DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), parseInt(offset));
  
  const items = db.prepare(query).all(...params);
  
  let countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE 1=1';
  const countParams = [];
  
  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }
  
  if (priority) {
    countQuery += ' AND priority = ?';
    countParams.push(priority);
  }
  
  if (batch_id) {
    countQuery += ' AND batch_id = ?';
    countParams.push(batch_id);
  }
  
  const { total } = db.prepare(countQuery).get(...countParams);
  
  res.json({
    data: items,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare(`
    SELECT t.*, ai.name as interface_name, tb.name as batch_name
    FROM tasks t
    LEFT JOIN api_interfaces ai ON t.related_interface_id = ai.id
    LEFT JOIN test_batches tb ON t.batch_id = tb.id
    WHERE t.id = ?
  `).get(id);
  
  if (!item) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  res.json({ data: item });
});

router.post('/', (req, res) => {
  const { title, description, priority, status, batch_id, related_interface_id, bottleneck_type, assignee, due_date } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '任务标题为必填项' });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO tasks (
      id, title, description, priority, status, batch_id, related_interface_id,
      bottleneck_type, assignee, due_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, description,
    priority || 'medium',
    status || 'todo',
    batch_id || null,
    related_interface_id || null,
    bottleneck_type || null,
    assignee || null,
    due_date || null,
    now, now
  );
  
  res.json({ 
    data: { 
      id, 
      title, 
      description,
      priority: priority || 'medium',
      status: status || 'todo'
    } 
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, batch_id, related_interface_id, bottleneck_type, assignee, due_date } = req.body;
  
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  const now = new Date().toISOString();
  const completedAt = status === 'done' && existing.status !== 'done' ? now : existing.completed_at;
  
  db.prepare(`
    UPDATE tasks SET
      title = ?, description = ?, priority = ?, status = ?, batch_id = ?,
      related_interface_id = ?, bottleneck_type = ?, assignee = ?, due_date = ?,
      completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title || existing.title,
    description ?? existing.description,
    priority || existing.priority,
    status || existing.status,
    batch_id ?? existing.batch_id,
    related_interface_id ?? existing.related_interface_id,
    bottleneck_type ?? existing.bottleneck_type,
    assignee ?? existing.assignee,
    due_date ?? existing.due_date,
    completedAt,
    now,
    id
  );
  
  const updated = db.prepare(`
    SELECT t.*, ai.name as interface_name, tb.name as batch_name
    FROM tasks t
    LEFT JOIN api_interfaces ai ON t.related_interface_id = ai.id
    LEFT JOIN test_batches tb ON t.batch_id = tb.id
    WHERE t.id = ?
  `).get(id);
  
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

router.post('/:id/complete', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '任务不存在' });
  }
  
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
  
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ data: updated });
});

export default router;
