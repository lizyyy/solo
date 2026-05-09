import express from 'express';
import { db } from '../db';

const router = express.Router();

router.get('/', (req, res) => {
  const { name } = req.query;

  let sql = 'SELECT * FROM merchants WHERE 1=1';
  const params: any[] = [];

  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }

  sql += ' ORDER BY name';

  const merchants = db.prepare(sql).all(...params);

  res.json({
    success: true,
    data: merchants
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;

  const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(id) as any;
  if (!merchant) {
    return res.status(404).json({ success: false, message: '商户不存在' });
  }

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN amount ELSE 0 END) as approved_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_count,
      SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as settled_amount
    FROM receipts
    WHERE merchant_id = ?
  `).get(id) as any;

  const settlements = db.prepare(`
    SELECT * FROM settlements 
    WHERE merchant_id = ? 
    ORDER BY settlement_month DESC
    LIMIT 12
  `).all(id);

  res.json({
    success: true,
    data: {
      ...merchant,
      stats,
      recent_settlements: settlements
    }
  });
});

export default router;
