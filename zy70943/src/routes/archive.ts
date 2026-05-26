import { Router, Request, Response } from 'express';
import db from '../config/database';
import { BATCH_STATUS, DETAIL_STATUS } from '../config/constants';
import { authMiddleware } from '../middleware/auth';
import { nowTimestamp } from '../utils/helpers';
import { recordAuditLog } from './deduction-details';

const router = Router();

router.post('/batch/:batchId', authMiddleware, (req: Request, res: Response) => {
  const batchId = parseInt(req.params.batchId);

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any;

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  if (batch.status === BATCH_STATUS.ARCHIVED) {
    return res.status(400).json({ error: '该批次已归档' });
  }

  const pendingDetails = db.prepare(`
    SELECT COUNT(*) as count 
    FROM deduction_details 
    WHERE batch_id = ? AND status NOT IN (?, ?)
  `).get(batchId, DETAIL_STATUS.CONFIRMED, DETAIL_STATUS.REJECTED) as any;

  if (pendingDetails.count > 0) {
    return res.status(400).json({ error: '存在未处理完成的扣罚明细，无法归档' });
  }

  const tx = db.transaction(() => {
    const now = nowTimestamp();

    db.prepare(`
      UPDATE batches 
      SET status = ?, archived_at = ?, archived_by = ?, updated_at = ?
      WHERE id = ?
    `).run(BATCH_STATUS.ARCHIVED, now, req.user!.id, now, batchId);

    db.prepare(`
      UPDATE deduction_details
      SET status = ?, updated_at = ?
      WHERE batch_id = ?
    `).run(DETAIL_STATUS.ARCHIVED, now, batchId);

    const details = db.prepare('SELECT id FROM deduction_details WHERE batch_id = ?').all(batchId) as any[];

    for (const detail of details) {
      recordAuditLog(
        detail.id,
        batchId,
        req.user!.id,
        req.user!.real_name,
        'archive',
        'status',
        null,
        DETAIL_STATUS.ARCHIVED,
        '批次归档'
      );
    }
  });

  tx();

  const updatedBatch = db.prepare(`
    SELECT b.*, u.real_name as archived_by_name
    FROM batches b
    LEFT JOIN users u ON b.archived_by = u.id
    WHERE b.id = ?
  `).get(batchId);

  res.json({
    message: '归档成功',
    batch: updatedBatch,
  });
});

router.post('/detail/:detailId', authMiddleware, (req: Request, res: Response) => {
  const detailId = parseInt(req.params.detailId);

  const detail = db.prepare('SELECT * FROM deduction_details WHERE id = ?').get(detailId) as any;

  if (!detail) {
    return res.status(404).json({ error: '扣罚明细不存在' });
  }

  if (detail.status === DETAIL_STATUS.ARCHIVED) {
    return res.status(400).json({ error: '该明细已归档' });
  }

  if (![DETAIL_STATUS.CONFIRMED, DETAIL_STATUS.REJECTED].includes(detail.status)) {
    return res.status(400).json({ error: '只有已确认或已驳回的明细才能归档' });
  }

  const tx = db.transaction(() => {
    const now = nowTimestamp();

    db.prepare(`
      UPDATE deduction_details
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(DETAIL_STATUS.ARCHIVED, now, detailId);

    recordAuditLog(
      detailId,
      detail.batch_id,
      req.user!.id,
      req.user!.real_name,
      'archive',
      'status',
      detail.status,
      DETAIL_STATUS.ARCHIVED,
      '单条明细归档'
    );

    db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(now, detail.batch_id);

    const batchDetails = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as archived
      FROM deduction_details
      WHERE batch_id = ?
    `).get(DETAIL_STATUS.ARCHIVED, detail.batch_id) as any;

    if (batchDetails.total === batchDetails.archived) {
      db.prepare(`
      UPDATE batches SET status = ?, archived_at = ?, archived_by = ?, updated_at = ?
      WHERE id = ?
    `).run(BATCH_STATUS.ARCHIVED, now, req.user!.id, now, detail.batch_id);
    }
  });

  tx();

  const updatedDetail = db.prepare('SELECT * FROM deduction_details WHERE id = ?').get(detailId);

  res.json({
    message: '归档成功',
    detail: updatedDetail,
  });
});

export default router;
