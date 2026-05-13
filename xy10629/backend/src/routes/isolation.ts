import express from 'express';
import { run, get, all } from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, source_type, handler, keyword } = req.query;
    let sql = 'SELECT * FROM failure_isolations WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (source_type) {
      sql += ' AND source_type = ?';
      params.push(source_type);
    }
    if (handler) {
      sql += ' AND handler = ?';
      params.push(handler);
    }
    if (keyword) {
      sql += ' AND (isolation_no LIKE ? OR reason LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const isolations = await all(sql, params);
    res.json({ success: true, data: isolations });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const isolation = await get('SELECT * FROM failure_isolations WHERE id = ?', [req.params.id]);
    if (!isolation) {
      return res.status(404).json({ success: false, message: '隔离记录不存在' });
    }
    res.json({ success: true, data: isolation });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { isolation_no, source_type, source_id, reason, handler, isolation_time, status, corrective_action, notes } = req.body;
    const result = await run(
      'INSERT INTO failure_isolations (isolation_no, source_type, source_id, reason, handler, isolation_time, status, corrective_action, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [isolation_no, source_type, source_id, reason, handler, isolation_time, status || 'isolated', corrective_action, notes]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { ...updateData } = req.body;
    const updates = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => updateData[key]);

    if (updates) {
      await run(`UPDATE failure_isolations SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
