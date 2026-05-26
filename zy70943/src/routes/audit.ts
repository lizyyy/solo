import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { buildPaginationResponse, formatTimestamp } from '../utils/helpers';

const router = Router();

router.get('/detail/:detailId', authMiddleware, (req: Request, res: Response) => {
  const detailId = parseInt(req.params.detailId);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.page_size as string) || 50;
  const offset = (page - 1) * pageSize;

  const detail = db.prepare('SELECT * FROM deduction_details WHERE id = ?').get(detailId);
  if (!detail) {
    return res.status(404).json({ error: '扣罚明细不存在' });
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total 
    FROM audit_logs 
    WHERE deduction_detail_id = ?
  `).get(detailId) as any;

  const logs = db.prepare(`
    SELECT 
      id,
      operator_name,
      action,
      field_name,
      old_value,
      new_value,
      change_reason,
      created_at
    FROM audit_logs
    WHERE deduction_detail_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(detailId, pageSize, offset);

  const formattedLogs = logs.map((log: any) => ({
    ...log,
    created_at_str: formatTimestamp(log.created_at),
  }));

  res.json(buildPaginationResponse(formattedLogs, countResult.total, page, pageSize));
});

router.get('/batch/:batchId', authMiddleware, (req: Request, res: Response) => {
  const batchId = parseInt(req.params.batchId);
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.page_size as string) || 50;
  const offset = (page - 1) * pageSize;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total 
    FROM audit_logs 
    WHERE batch_id = ?
  `).get(batchId) as any;

  const logs = db.prepare(`
    SELECT 
      al.id,
      al.deduction_detail_id,
      al.operator_name,
      al.action,
      al.field_name,
      al.old_value,
      al.new_value,
      al.change_reason,
      al.created_at,
      d.detail_no,
      d.waybill_no
    FROM audit_logs al
    LEFT JOIN deduction_details d ON al.deduction_detail_id = d.id
    WHERE al.batch_id = ?
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(batchId, pageSize, offset);

  const formattedLogs = logs.map((log: any) => ({
    ...log,
    created_at_str: formatTimestamp(log.created_at),
  }));

  res.json(buildPaginationResponse(formattedLogs, countResult.total, page, pageSize));
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.page_size as string) || 50;
  const action = req.query.action as string;
  const operatorName = req.query.operator_name as string;
  const start_time = req.query.start_time as string;
  const end_time = req.query.end_time as string;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (action) {
    whereClause += ' AND al.action = ?';
    params.push(action);
  }

  if (operatorName) {
    whereClause += ' AND al.operator_name LIKE ?';
    params.push(`%${operatorName}%`);
  }

  if (start_time) {
    whereClause += ' AND al.created_at >= ?';
    params.push(parseInt(start_time));
  }

  if (end_time) {
    whereClause += ' AND al.created_at <= ?';
    params.push(parseInt(end_time));
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total 
    FROM audit_logs al
    ${whereClause}
  `).get(...params) as any;

  const logs = db.prepare(`
    SELECT 
      al.id,
      al.deduction_detail_id,
      al.batch_id,
      al.operator_name,
      al.action,
      al.field_name,
      al.old_value,
      al.new_value,
      al.change_reason,
      al.created_at,
      d.detail_no,
      d.waybill_no,
      b.batch_no,
      b.name as batch_name
    FROM audit_logs al
    LEFT JOIN deduction_details d ON al.deduction_detail_id = d.id
    LEFT JOIN batches b ON al.batch_id = b.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  const formattedLogs = logs.map((log: any) => ({
    ...log,
    created_at_str: formatTimestamp(log.created_at),
  }));

  res.json(buildPaginationResponse(formattedLogs, countResult.total, page, pageSize));
});

export default router;
