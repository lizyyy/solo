import express from 'express';
import db from '../database';

const router = express.Router();

router.get('/', async (req, res) => {
  const { status, courier_company_id } = req.query;
  let query = `
    SELECT s.*, c.name as courier_company_name
    FROM settlements s
    JOIN courier_companies c ON s.courier_company_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }
  if (courier_company_id) {
    query += ' AND s.courier_company_id = ?';
    params.push(courier_company_id);
  }
  query += ' ORDER BY s.created_at DESC';
  
  try {
    const settlements = await db.all(query, params);
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: '查询结算单失败', details: (error as Error).message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(COALESCE(total_fee, 0)) as total_fee
      FROM settlements
    `) || { total: 0, draft: 0, confirmed: 0, total_fee: 0 };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '查询结算统计失败', details: (error as Error).message });
  }
});

router.post('/', async (req, res) => {
  const { courier_company_id, start_date, end_date } = req.body;
  
  if (!courier_company_id || !start_date || !end_date) {
    return res.status(400).json({ error: '快递公司、开始日期和结束日期为必填项' });
  }
  
  if (new Date(start_date) > new Date(end_date)) {
    return res.status(400).json({ error: '开始日期不能晚于结束日期' });
  }
  
  try {
    const company = await db.get('SELECT * FROM courier_companies WHERE id = ?', [courier_company_id]);
    if (!company) {
      return res.status(400).json({ error: '快递公司不存在' });
    }

    const packages = await db.all(`
      SELECT * FROM packages
      WHERE courier_company_id = ?
      AND scan_time >= ?
      AND scan_time <= ?
    `, [courier_company_id, start_date, end_date]);

    let totalPackages = 0;
    let totalFee = 0;
    let deliveryFeeTotal = 0;
    let returnFeeTotal = 0;
    let storageFeeTotal = 0;
    let pendingCount = 0;
    let deliveredCount = 0;
    let returnedCount = 0;

    packages.forEach((pkg: any) => {
      totalPackages++;
      totalFee += pkg.total_fee || 0;
      deliveryFeeTotal += pkg.delivery_fee || 0;
      returnFeeTotal += pkg.return_fee || 0;
      storageFeeTotal += pkg.storage_fee || 0;
      
      if (pkg.status === 'pending') pendingCount++;
      else if (pkg.status === 'delivered') deliveredCount++;
      else if (pkg.status === 'returned') returnedCount++;
    });

    const result = await db.run(`
      INSERT INTO settlements (
        courier_company_id, start_date, end_date, 
        total_packages, total_fee, delivery_fee_total, 
        return_fee_total, storage_fee_total,
        pending_count, delivered_count, returned_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      courier_company_id, start_date, end_date, 
      totalPackages, totalFee, deliveryFeeTotal, 
      returnFeeTotal, storageFeeTotal,
      pendingCount, deliveredCount, returnedCount
    ]);

    const newSettlement = await db.get(`
      SELECT s.*, c.name as courier_company_name
      FROM settlements s
      JOIN courier_companies c ON s.courier_company_id = c.id
      WHERE s.id = ?
    `, [result.lastID]);
    
    res.status(201).json(newSettlement);
  } catch (error) {
    res.status(500).json({ error: '创建结算单失败', details: (error as Error).message });
  }
});

router.patch('/:id/confirm', async (req, res) => {
  const { id } = req.params;
  
  try {
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [id]);
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    
    if ((settlement as any).status === 'confirmed') {
      return res.status(400).json({ error: '该结算单已确认，不可重复确认' });
    }
    
    await db.run('UPDATE settlements SET status = ? WHERE id = ?', ['confirmed', id]);
    const updatedSettlement = await db.get(`
      SELECT s.*, c.name as courier_company_name
      FROM settlements s
      JOIN courier_companies c ON s.courier_company_id = c.id
      WHERE s.id = ?
    `, [id]);
    
    res.json(updatedSettlement);
  } catch (error) {
    res.status(500).json({ error: '确认结算单失败', details: (error as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const settlement = await db.get(`
      SELECT s.*, c.name as courier_company_name
      FROM settlements s
      JOIN courier_companies c ON s.courier_company_id = c.id
      WHERE s.id = ?
    `, [id]);
    
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    res.json(settlement);
  } catch (error) {
    res.status(500).json({ error: '查询结算单失败', details: (error as Error).message });
  }
});

router.get('/:id/export', async (req, res) => {
  const { id } = req.params;
  
  try {
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [id]);
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }

    const packages = await db.all(`
      SELECT p.*, c.name as courier_company_name, c.code as courier_company_code
      FROM packages p
      JOIN courier_companies c ON p.courier_company_id = c.id
      WHERE p.courier_company_id = ?
      AND p.scan_time >= ?
      AND p.scan_time <= ?
      ORDER BY p.scan_time DESC
    `, [(settlement as any).courier_company_id, (settlement as any).start_date, (settlement as any).end_date]);

    res.json({ settlement, packages });
  } catch (error) {
    res.status(500).json({ error: '导出结算单失败', details: (error as Error).message });
  }
});

export default router;
