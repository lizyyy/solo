import express from 'express';
import db from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const companies = await db.all('SELECT * FROM courier_companies ORDER BY created_at DESC');
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: '查询快递公司失败', details: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { name, code, delivery_fee, return_fee, storage_fee_per_day } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ error: '公司名称和编码为必填项' });
  }
  
  try {
    const existing = await db.get('SELECT * FROM courier_companies WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ error: '该公司编码已存在' });
    }
    
    const result = await db.run(`
      INSERT INTO courier_companies (name, code, delivery_fee, return_fee, storage_fee_per_day)
      VALUES (?, ?, ?, ?, ?)
    `, [name, code, delivery_fee || 1.0, return_fee || 2.0, storage_fee_per_day || 0.5]);
    
    const newCompany = await db.get('SELECT * FROM courier_companies WHERE id = ?', [result.lastID]);
    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).json({ error: '创建快递公司失败', details: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, delivery_fee, return_fee, storage_fee_per_day } = req.body;
  
  try {
    const existing = await db.get('SELECT * FROM courier_companies WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: '快递公司不存在' });
    }
    
    await db.run(`
      UPDATE courier_companies
      SET name = ?, code = ?, delivery_fee = ?, return_fee = ?, storage_fee_per_day = ?
      WHERE id = ?
    `, [name, code, delivery_fee, return_fee, storage_fee_per_day, id]);
    
    const updatedCompany = await db.get('SELECT * FROM courier_companies WHERE id = ?', [id]);
    res.json(updatedCompany);
  } catch (error) {
    res.status(500).json({ error: '更新快递公司失败', details: (error as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const packages = await db.get('SELECT COUNT(*) as count FROM packages WHERE courier_company_id = ?', [id]);
    if ((packages as any).count > 0) {
      return res.status(400).json({ error: '该快递公司存在关联包裹，无法删除' });
    }
    
    await db.run('DELETE FROM retention_rules WHERE courier_company_id = ?', [id]);
    await db.run('DELETE FROM courier_companies WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除快递公司失败', details: (error as Error).message });
  }
});

export default router;
