import express from 'express';
import { run, get, all } from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { department, distributor, keyword, startDate, endDate } = req.query;
    let sql = `
      SELECT d.*, p.package_no, p.name as package_name
      FROM department_distributions d
      LEFT JOIN instrument_packages p ON d.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (department) {
      sql += ' AND d.department = ?';
      params.push(department);
    }
    if (distributor) {
      sql += ' AND d.distributor = ?';
      params.push(distributor);
    }
    if (keyword) {
      sql += ' AND (d.distribution_no LIKE ? OR p.name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startDate) {
      sql += ' AND d.distribution_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND d.distribution_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY d.created_at DESC';
    const distributions = await all(sql, params);
    res.json({ success: true, data: distributions });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const distribution = await get('SELECT * FROM department_distributions WHERE id = ?', [req.params.id]);
    if (!distribution) {
      return res.status(404).json({ success: false, message: '发放记录不存在' });
    }
    res.json({ success: true, data: distribution });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { distribution_no, package_id, department, distributor, distribution_time, receiver, notes } = req.body;
    const result = await run(
      'INSERT INTO department_distributions (distribution_no, package_id, department, distributor, distribution_time, receiver, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [distribution_no, package_id, department, distributor, distribution_time, receiver, notes]
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
      await run(`UPDATE department_distributions SET ${updates}, updated_at = datetime('now', 'localtime') WHERE id = ?`, [...values, req.params.id]);
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
