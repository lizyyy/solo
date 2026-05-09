import express from 'express';
import { db } from '../db';

const router = express.Router();

router.get('/overview', (req, res) => {
  const receiptStats = db.prepare(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicate_count,
      SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_count,
      SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as settled_amount,
      SUM(CASE WHEN status = 'appealed' THEN 1 ELSE 0 END) as appealed_count
    FROM receipts
  `).get() as any;

  const appealStats = db.prepare(`
    SELECT 
      COUNT(*) as total_appeals,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_appeals,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_appeals,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_appeals
    FROM appeals
  `).get() as any;

  const employeeStats = db.prepare(`
    SELECT 
      COUNT(*) as total_employees,
      SUM(monthly_allowance) as total_allowance,
      SUM(used_amount) as total_used,
      SUM(monthly_allowance - used_amount) as total_remaining
    FROM employees
  `).get() as any;

  const merchantStats = db.prepare(`
    SELECT COUNT(*) as total_merchants FROM merchants
  `).get() as any;

  const settlementStats = db.prepare(`
    SELECT 
      COUNT(*) as total_settlements,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_settlements,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_settlements,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_settlements,
      SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as completed_amount
    FROM settlements
  `).get() as any;

  const recentActivity = db.prepare(`
    SELECT 
      'receipt' as type,
      r.id,
      r.receipt_no,
      r.amount,
      r.status,
      r.created_at,
      e.name as related_name
    FROM receipts r
    LEFT JOIN employees e ON r.employee_id = e.id
    WHERE r.created_at >= datetime('now', '-7 days')
    
    UNION ALL
    
    SELECT 
      'appeal' as type,
      a.id,
      NULL as receipt_no,
      NULL as amount,
      a.status,
      a.created_at,
      a.appellant as related_name
    FROM appeals a
    WHERE a.created_at >= datetime('now', '-7 days')
    
    UNION ALL
    
    SELECT 
      'settlement' as type,
      s.id,
      s.settlement_month as receipt_no,
      s.total_amount as amount,
      s.status,
      s.created_at,
      m.name as related_name
    FROM settlements s
    LEFT JOIN merchants m ON s.merchant_id = m.id
    WHERE s.created_at >= datetime('now', '-7 days')
    
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const departmentStats = db.prepare(`
    SELECT 
      e.department,
      COUNT(*) as employee_count,
      SUM(e.monthly_allowance) as total_allowance,
      SUM(e.used_amount) as total_used,
      SUM(e.monthly_allowance - e.used_amount) as total_remaining,
      AVG(e.used_amount / e.monthly_allowance * 100) as avg_usage_rate
    FROM employees e
    GROUP BY e.department
    ORDER BY e.department
  `).all();

  res.json({
    success: true,
    data: {
      receipt_stats: receiptStats,
      appeal_stats: appealStats,
      employee_stats: employeeStats,
      merchant_stats: merchantStats,
      settlement_stats: settlementStats,
      recent_activity: recentActivity,
      department_stats: departmentStats
    }
  });
});

router.get('/duplicates', (req, res) => {
  const groups = db.prepare(`
    SELECT 
      dg.id,
      dg.receipt_no,
      dg.count,
      dg.created_at,
      m.name as merchant_name,
      m.id as merchant_id
    FROM duplicate_groups dg
    LEFT JOIN merchants m ON dg.merchant_id = m.id
    ORDER BY dg.created_at DESC
  `).all();

  const groupsWithDetails = groups.map((group: any) => {
    const receipts = db.prepare(`
      SELECT r.*, e.name as employee_name, e.department
      FROM receipts r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.duplicate_group_id = ?
      ORDER BY r.upload_date ASC
    `).all(group.id);

    return {
      ...group,
      receipts
    };
  });

  res.json({
    success: true,
    data: groupsWithDetails
  });
});

export default router;
