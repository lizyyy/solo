import express from 'express';
import { run, get, all } from '../database';
import { compareAndRecordChanges, getModificationHistory } from '../utils/history';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { result, cleaner, keyword, startDate, endDate } = req.query;
    let sql = `
      SELECT c.*, r.recovery_no, p.package_no, p.name as package_name
      FROM cleaning_records c
      LEFT JOIN recovery_records r ON c.recovery_id = r.id
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (result) {
      sql += ' AND c.result = ?';
      params.push(result);
    }
    if (cleaner) {
      sql += ' AND c.cleaner = ?';
      params.push(cleaner);
    }
    if (keyword) {
      sql += ' AND (c.cleaning_no LIKE ? OR p.name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startDate) {
      sql += ' AND c.start_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND c.end_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY c.created_at DESC';
    const records = await all(sql, params);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await get('SELECT * FROM cleaning_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '清洗记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getModificationHistory('cleaning_records', parseInt(req.params.id));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { cleaning_no, recovery_id, cleaner, cleaning_method, start_time, end_time, result, temperature, duration, notes } = req.body;
    const resultRun = await run(
      'INSERT INTO cleaning_records (cleaning_no, recovery_id, cleaner, cleaning_method, start_time, end_time, result, temperature, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cleaning_no, recovery_id, cleaner, cleaning_method, start_time, end_time, result, temperature, duration, notes]
    );
    res.json({ success: true, data: { id: resultRun.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { modified_by, ...updateData } = req.body;
    const oldData = await get('SELECT * FROM cleaning_records WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, message: '清洗记录不存在' });
    }

    const updates = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => updateData[key]);

    if (updates) {
      await compareAndRecordChanges('cleaning_records', parseInt(req.params.id), oldData, updateData, modified_by || 'system');
      await run(`UPDATE cleaning_records SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
