import express from 'express';
import { run, get, all } from '../database';
import { compareAndRecordChanges, getModificationHistory } from '../utils/history';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, department, keyword, startDate, endDate } = req.query;
    let sql = `
      SELECT r.*, p.package_no, p.name as package_name 
      FROM recovery_records r
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (department) {
      sql += ' AND r.department = ?';
      params.push(department);
    }
    if (keyword) {
      sql += ' AND (r.recovery_no LIKE ? OR p.name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startDate) {
      sql += ' AND r.recovery_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND r.recovery_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY r.created_at DESC';
    const records = await all(sql, params);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await get('SELECT * FROM recovery_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ success: false, message: '回收记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getModificationHistory('recovery_records', parseInt(req.params.id));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { recovery_no, package_id, department, recovery_time, receiver, notes } = req.body;
    const result = await run(
      'INSERT INTO recovery_records (recovery_no, package_id, department, recovery_time, receiver, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [recovery_no, package_id, department, recovery_time, receiver, notes]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { modified_by, ...updateData } = req.body;
    const oldData = await get('SELECT * FROM recovery_records WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, message: '回收记录不存在' });
    }

    const updates = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => updateData[key]);

    if (updates) {
      await compareAndRecordChanges('recovery_records', parseInt(req.params.id), oldData, updateData, modified_by || 'system');
      await run(`UPDATE recovery_records SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
