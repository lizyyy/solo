import { Router, Request, Response } from 'express';
import db from '../config/database';
import { DETAIL_STATUS } from '../config/constants';
import { authMiddleware } from '../middleware/auth';
import { generateDetailNo, nowTimestamp, buildPaginationResponse } from '../utils/helpers';

const router = Router();

function recordAuditLog(
  detailId: number | null,
  batchId: number | null,
  operatorId: number,
  operatorName: string,
  action: string,
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null,
  changeReason: string | null
) {
  db.prepare(`
    INSERT INTO audit_logs (
      deduction_detail_id, batch_id, operator_id, operator_name,
      action, field_name, old_value, new_value, change_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    detailId,
    batchId,
    operatorId,
    operatorName,
    action,
    fieldName,
    oldValue,
    newValue,
    changeReason,
    nowTimestamp()
  );
}

router.post('/', authMiddleware, (req: Request, res: Response) => {
  const {
    batch_id,
    waybill_no,
    exception_type,
    exception_time,
    from_city,
    to_city,
    carrier,
    vehicle_no,
    driver,
    original_amount,
    deduction_amount,
    responsible_party,
  } = req.body;

  if (!batch_id || !waybill_no || !exception_type || !exception_time) {
    return res.status(400).json({ error: '批次ID、运单号、异常类型、异常时间不能为空' });
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const detailNo = generateDetailNo();
  const now = nowTimestamp();

  const result = db.prepare(`
    INSERT INTO deduction_details (
      batch_id, detail_no, waybill_no, exception_type, exception_time,
      from_city, to_city, carrier, vehicle_no, driver,
      original_amount, deduction_amount, responsible_party,
      status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batch_id,
    detailNo,
    waybill_no,
    exception_type,
    exception_time,
    from_city || null,
    to_city || null,
    carrier || null,
    vehicle_no || null,
    driver || null,
    original_amount || 0,
    deduction_amount || 0,
    responsible_party || null,
    DETAIL_STATUS.PENDING,
    req.user!.id,
    now,
    now
  );

  const detailId = result.lastInsertRowid as number;

  recordAuditLog(
    detailId,
    batch_id,
    req.user!.id,
    req.user!.real_name,
    'create',
    null,
    null,
    null,
    '创建扣罚明细'
  );

  const detail = db.prepare(`
    SELECT d.*, u.real_name as created_by_name
    FROM deduction_details d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.id = ?
  `).get(detailId);

  res.status(201).json({
    message: '扣罚明细创建成功',
    detail,
  });
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.page_size as string) || 20;
  const batchId = req.query.batch_id as string;
  const status = req.query.status as string;
  const exceptionType = req.query.exception_type as string;
  const waybillNo = req.query.waybill_no as string;
  const start_time = req.query.start_time as string;
  const end_time = req.query.end_time as string;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (batchId) {
    whereClause += ' AND d.batch_id = ?';
    params.push(parseInt(batchId));
  }

  if (status) {
    whereClause += ' AND d.status = ?';
    params.push(status);
  }

  if (exceptionType) {
    whereClause += ' AND d.exception_type = ?';
    params.push(exceptionType);
  }

  if (waybillNo) {
    whereClause += ' AND d.waybill_no LIKE ?';
    params.push(`%${waybillNo}%`);
  }

  if (start_time) {
    whereClause += ' AND d.exception_time >= ?';
    params.push(parseInt(start_time));
  }

  if (end_time) {
    whereClause += ' AND d.exception_time <= ?';
    params.push(parseInt(end_time));
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM deduction_details d ${whereClause}
  `).get(...params) as any;

  const items = db.prepare(`
    SELECT d.*, 
           u.real_name as created_by_name,
           h.real_name as handled_by_name
    FROM deduction_details d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN users h ON d.handled_by = h.id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  res.json(buildPaginationResponse(items, countResult.total, page, pageSize));
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const detailId = parseInt(req.params.id);

  const detail = db.prepare(`
    SELECT d.*, 
           u.real_name as created_by_name,
           h.real_name as handled_by_name,
           b.batch_no,
           b.name as batch_name
    FROM deduction_details d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN users h ON d.handled_by = h.id
    LEFT JOIN batches b ON d.batch_id = b.id
    WHERE d.id = ?
  `).get(detailId) as any;

  if (!detail) {
    return res.status(404).json({ error: '扣罚明细不存在' });
  }

  const reconciliations = db.prepare(`
    SELECT * FROM reconciliation_items
    WHERE deduction_detail_id = ?
    ORDER BY created_at DESC
  `).all(detailId);

  res.json({
    detail,
    reconciliations,
  });
});

router.put('/:id/process', authMiddleware, (req: Request, res: Response) => {
  const detailId = parseInt(req.params.id);
  const {
    status,
    conclusion,
    deduction_amount,
    responsible_party,
    matched_items,
    change_reason,
  } = req.body;

  const detail = db.prepare('SELECT * FROM deduction_details WHERE id = ?').get(detailId) as any;
  if (!detail) {
    return res.status(404).json({ error: '扣罚明细不存在' });
  }

  if (!status) {
    return res.status(400).json({ error: '处理状态不能为空' });
  }

  const tx = db.transaction(() => {
    const now = nowTimestamp();
    const updates: string[] = [];
    const updateParams: any[] = [];

    if (status && status !== detail.status) {
      updates.push('status = ?');
      updateParams.push(status);
      recordAuditLog(
        detailId,
        detail.batch_id,
        req.user!.id,
        req.user!.real_name,
        'update',
        'status',
        detail.status,
        status,
        change_reason || null
      );
    }

    if (conclusion !== undefined && conclusion !== detail.conclusion) {
      updates.push('conclusion = ?');
      updateParams.push(conclusion);
      recordAuditLog(
        detailId,
        detail.batch_id,
        req.user!.id,
        req.user!.real_name,
        'update',
        'conclusion',
        detail.conclusion,
        conclusion,
        change_reason || null
      );
    }

    if (deduction_amount !== undefined && deduction_amount !== detail.deduction_amount) {
      updates.push('deduction_amount = ?');
      updateParams.push(deduction_amount);
      recordAuditLog(
        detailId,
        detail.batch_id,
        req.user!.id,
        req.user!.real_name,
        'update',
        'deduction_amount',
        String(detail.deduction_amount),
        String(deduction_amount),
        change_reason || null
      );
    }

    if (responsible_party !== undefined && responsible_party !== detail.responsible_party) {
      updates.push('responsible_party = ?');
      updateParams.push(responsible_party);
      recordAuditLog(
        detailId,
        detail.batch_id,
        req.user!.id,
        req.user!.real_name,
        'update',
        'responsible_party',
        detail.responsible_party,
        responsible_party,
        change_reason || null
      );
    }

    if (updates.length > 0) {
      updates.push('handled_by = ?');
      updateParams.push(req.user!.id);
      updates.push('handled_at = ?');
      updateParams.push(now);
      updates.push('final_handler_id = ?');
      updateParams.push(req.user!.id);
      updates.push('final_handler_name = ?');
      updateParams.push(req.user!.real_name);
      updates.push('updated_at = ?');
      updateParams.push(now);
      updateParams.push(detailId);

      const updateSql = `UPDATE deduction_details SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(updateSql).run(...updateParams);
    }

    if (matched_items && Array.isArray(matched_items) && matched_items.length > 0) {
      db.prepare('DELETE FROM reconciliation_items WHERE deduction_detail_id = ?').run(detailId);

      const insertRecon = db.prepare(`
        INSERT INTO reconciliation_items (
          deduction_detail_id, source_type, source_waybill_no,
          source_data, matched_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of matched_items) {
        insertRecon.run(
          detailId,
          item.source_type,
          item.source_waybill_no,
          item.source_data ? JSON.stringify(item.source_data) : null,
          item.matched_amount || 0,
          now
        );
      }

      recordAuditLog(
        detailId,
        detail.batch_id,
        req.user!.id,
        req.user!.real_name,
        'reconcile',
        'matched_items',
        null,
        JSON.stringify(matched_items),
        change_reason || '更新多单核对信息'
      );
    }

    db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(now, detail.batch_id);
  });

  tx();

  const updatedDetail = db.prepare(`
    SELECT d.*, 
           u.real_name as created_by_name,
           h.real_name as handled_by_name
    FROM deduction_details d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN users h ON d.handled_by = h.id
    WHERE d.id = ?
  `).get(detailId);

  const reconciliations = db.prepare(`
    SELECT * FROM reconciliation_items
    WHERE deduction_detail_id = ?
    ORDER BY created_at DESC
  `).all(detailId);

  res.json({
    message: '处理成功',
    detail: updatedDetail,
    reconciliations,
  });
});

router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const detailId = parseInt(req.params.id);

  const detail = db.prepare('SELECT * FROM deduction_details WHERE id = ?').get(detailId) as any;
  if (!detail) {
    return res.status(404).json({ error: '扣罚明细不存在' });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM reconciliation_items WHERE deduction_detail_id = ?').run(detailId);
    db.prepare('DELETE FROM audit_logs WHERE deduction_detail_id = ?').run(detailId);
    db.prepare('DELETE FROM deduction_details WHERE id = ?').run(detailId);
    db.prepare('UPDATE batches SET updated_at = ? WHERE id = ?').run(nowTimestamp(), detail.batch_id);
  });

  tx();

  res.json({ message: '扣罚明细删除成功' });
});

export { recordAuditLog };
export default router;
