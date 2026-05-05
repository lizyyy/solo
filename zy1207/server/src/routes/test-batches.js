import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 50, is_baseline } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `
    SELECT tb.*, tm.name as traffic_model_name
    FROM test_batches tb
    LEFT JOIN traffic_models tm ON tb.traffic_model_id = tm.id
    WHERE 1=1
  `;
  const params = [];
  
  if (is_baseline !== undefined) {
    query += ' AND tb.is_baseline = ?';
    params.push(is_baseline === 'true' ? 1 : 0);
  }
  
  query += ' ORDER BY tb.batch_number DESC, tb.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), parseInt(offset));
  
  const items = db.prepare(query).all(...params);
  
  let countQuery = 'SELECT COUNT(*) as total FROM test_batches WHERE 1=1';
  const countParams = [];
  
  if (is_baseline !== undefined) {
    countQuery += ' AND is_baseline = ?';
    countParams.push(is_baseline === 'true' ? 1 : 0);
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
    SELECT tb.*, tm.name as traffic_model_name
    FROM test_batches tb
    LEFT JOIN traffic_models tm ON tb.traffic_model_id = tm.id
    WHERE tb.id = ?
  `).get(id);
  
  if (!item) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  res.json({ data: item });
});

router.get('/:id/results', (req, res) => {
  const { id } = req.params;
  
  const results = db.prepare(`
    SELECT tr.*, ai.name as interface_name, ai.path as interface_path, ai.method as interface_method
    FROM test_results tr
    LEFT JOIN api_interfaces ai ON tr.interface_id = ai.id
    WHERE tr.batch_id = ?
    ORDER BY tr.qps DESC
  `).all(id);
  
  res.json({ data: results });
});

router.post('/', (req, res) => {
  const { name, batch_number, is_baseline, traffic_model_id, start_time, end_time, duration_seconds, notes, status } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '批次名称为必填项' });
  }
  
  let actualBatchNumber = batch_number;
  if (!actualBatchNumber) {
    const maxResult = db.prepare('SELECT MAX(batch_number) as max FROM test_batches').get();
    actualBatchNumber = (maxResult.max || 0) + 1;
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO test_batches (id, name, batch_number, is_baseline, traffic_model_id, start_time, end_time, duration_seconds, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, 
    name, 
    actualBatchNumber,
    is_baseline ? 1 : 0,
    traffic_model_id || null,
    start_time,
    end_time,
    duration_seconds,
    notes,
    status || 'completed',
    now,
    now
  );
  
  res.json({ data: { id, name, batch_number: actualBatchNumber } });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_baseline, traffic_model_id, start_time, end_time, duration_seconds, notes, status } = req.body;
  
  const existing = db.prepare('SELECT * FROM test_batches WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE test_batches 
    SET name = ?, is_baseline = ?, traffic_model_id = ?, start_time = ?, end_time = ?, duration_seconds = ?, notes = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    is_baseline !== undefined ? (is_baseline ? 1 : 0) : existing.is_baseline,
    traffic_model_id ?? existing.traffic_model_id,
    start_time ?? existing.start_time,
    end_time ?? existing.end_time,
    duration_seconds ?? existing.duration_seconds,
    notes ?? existing.notes,
    status || existing.status,
    now,
    id
  );
  
  const updated = db.prepare(`
    SELECT tb.*, tm.name as traffic_model_name
    FROM test_batches tb
    LEFT JOIN traffic_models tm ON tb.traffic_model_id = tm.id
    WHERE tb.id = ?
  `).get(id);
  
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM test_batches WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM test_results WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM monitoring_snapshots WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM capacity_assessments WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM test_batches WHERE id = ?').run(id);
  });
  
  transaction();
  res.json({ message: '删除成功' });
});

router.post('/:id/set-baseline', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM test_batches WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '压测批次不存在' });
  }
  
  const transaction = db.transaction(() => {
    db.prepare('UPDATE test_batches SET is_baseline = 0').run();
    db.prepare('UPDATE test_batches SET is_baseline = 1 WHERE id = ?').run(id);
  });
  
  transaction();
  res.json({ message: '已设置为基线版本' });
});

export default router;
