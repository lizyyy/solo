import express from 'express';
import { run, get, all } from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { result, sterilizer, keyword, startDate, endDate } = req.query;
    let sql = 'SELECT * FROM sterilization_batches WHERE 1=1';
    const params: any[] = [];

    if (result) {
      sql += ' AND result = ?';
      params.push(result);
    }
    if (sterilizer) {
      sql += ' AND sterilizer = ?';
      params.push(sterilizer);
    }
    if (keyword) {
      sql += ' AND batch_no LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (startDate) {
      sql += ' AND start_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND end_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY created_at DESC';
    const batches = await all(sql, params);
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await get('SELECT * FROM sterilization_batches WHERE id = ?', [req.params.id]);
    if (!batch) {
      return res.status(404).json({ success: false, message: '灭菌批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { batch_no, cleaning_ids, sterilizer, sterilization_method, start_time, end_time, temperature, pressure, duration, result, notes } = req.body;
    const resultRun = await run(
      'INSERT INTO sterilization_batches (batch_no, cleaning_ids, sterilizer, sterilization_method, start_time, end_time, temperature, pressure, duration, result, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [batch_no, JSON.stringify(cleaning_ids), sterilizer, sterilization_method, start_time, end_time, temperature, pressure, duration, result, notes]
    );
    res.json({ success: true, data: { id: resultRun.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { ...updateData } = req.body;
    const updates = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => key === 'cleaning_ids' ? `${key} = ?` : `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => key === 'cleaning_ids' ? JSON.stringify(updateData[key]) : updateData[key]);

    if (updates) {
      await run(`UPDATE sterilization_batches SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
