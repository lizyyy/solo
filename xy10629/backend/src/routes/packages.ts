import express from 'express';
import { run, get, all } from '../database';
import { compareAndRecordChanges, getModificationHistory } from '../utils/history';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { status, type, keyword } = req.query;
    let sql = 'SELECT * FROM instrument_packages WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (keyword) {
      sql += ' AND (name LIKE ? OR package_no LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const packages = await all(sql, params);
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pkg = await get('SELECT * FROM instrument_packages WHERE id = ?', [req.params.id]);
    if (!pkg) {
      return res.status(404).json({ success: false, message: '器械包不存在' });
    }
    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await getModificationHistory('instrument_packages', parseInt(req.params.id));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { package_no, name, type, instruments, modified_by } = req.body;
    const result = await run(
      'INSERT INTO instrument_packages (package_no, name, type, instruments) VALUES (?, ?, ?, ?)',
      [package_no, name, type, instruments ? JSON.stringify(instruments) : null]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { modified_by, ...updateData } = req.body;
    const oldData = await get('SELECT * FROM instrument_packages WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, message: '器械包不存在' });
    }

    const updates = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updateData)
      .filter(key => updateData[key] !== undefined)
      .map(key => updateData[key]);

    if (updates) {
      await compareAndRecordChanges('instrument_packages', parseInt(req.params.id), oldData, updateData, modified_by || 'system');
      await run(`UPDATE instrument_packages SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM instrument_packages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
