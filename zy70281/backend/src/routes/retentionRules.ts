import express from 'express';
import db from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rules = await db.all(`
      SELECT r.*, c.name as courier_company_name
      FROM retention_rules r
      LEFT JOIN courier_companies c ON r.courier_company_id = c.id
      ORDER BY r.created_at DESC
    `);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: '查询滞留规则失败', details: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { courier_company_id, free_days, storage_fee_per_day, is_global } = req.body;
  
  if (free_days === undefined || storage_fee_per_day === undefined) {
    return res.status(400).json({ error: '免费天数和每日保管费为必填项' });
  }
  
  try {
    if (is_global) {
      const existingGlobal = await db.get('SELECT * FROM retention_rules WHERE is_global = 1');
      if (existingGlobal) {
        return res.status(400).json({ error: '已存在全局滞留规则，请先删除后再创建' });
      }
    } else {
      if (!courier_company_id) {
        return res.status(400).json({ error: '非全局规则必须指定快递公司' });
      }
      
      const company = await db.get('SELECT * FROM courier_companies WHERE id = ?', [courier_company_id]);
      if (!company) {
        return res.status(400).json({ error: '快递公司不存在' });
      }
      
      const existing = await db.get('SELECT * FROM retention_rules WHERE courier_company_id = ?', [courier_company_id]);
      if (existing) {
        return res.status(400).json({ error: '该快递公司已有滞留规则' });
      }
    }
    
    const result = await db.run(`
      INSERT INTO retention_rules (courier_company_id, free_days, storage_fee_per_day, is_global)
      VALUES (?, ?, ?, ?)
    `, [courier_company_id || null, free_days, storage_fee_per_day, is_global ? 1 : 0]);
    
    const newRule = await db.get(`
      SELECT r.*, c.name as courier_company_name
      FROM retention_rules r
      LEFT JOIN courier_companies c ON r.courier_company_id = c.id
      WHERE r.id = ?
    `, [result.lastID]);
    
    res.status(201).json(newRule);
  } catch (error) {
    res.status(500).json({ error: '创建滞留规则失败', details: (error as Error).message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { courier_company_id, free_days, storage_fee_per_day, is_global } = req.body;
  
  try {
    const existing = await db.get('SELECT * FROM retention_rules WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: '滞留规则不存在' });
    }
    
    await db.run(`
      UPDATE retention_rules
      SET courier_company_id = ?, free_days = ?, storage_fee_per_day = ?, is_global = ?
      WHERE id = ?
    `, [courier_company_id || null, free_days, storage_fee_per_day, is_global ? 1 : 0, id]);
    
    const updatedRule = await db.get(`
      SELECT r.*, c.name as courier_company_name
      FROM retention_rules r
      LEFT JOIN courier_companies c ON r.courier_company_id = c.id
      WHERE r.id = ?
    `, [id]);
    
    res.json(updatedRule);
  } catch (error) {
    res.status(500).json({ error: '更新滞留规则失败', details: (error as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const rule = await db.get('SELECT * FROM retention_rules WHERE id = ?', [id]);
    if (!rule) {
      return res.status(404).json({ error: '滞留规则不存在' });
    }
    
    await db.run('DELETE FROM retention_rules WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除滞留规则失败', details: (error as Error).message });
  }
});

export default router;
