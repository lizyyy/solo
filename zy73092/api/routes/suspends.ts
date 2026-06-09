import express, { type Request, type Response } from 'express';
import { getDb, rowToSuspendConfirm, rowToMaterial } from '../db/database.js';
import type { SuspendConfirm, Material } from '../../shared/types.js';
import { AuditService } from '../services/AuditService.js';

const router = express.Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { materialId, reason, operator } = req.body as { materialId?: number; reason?: string; operator?: string };
    if (!materialId) {
      return res.status(400).json({ success: false, error: 'materialId 必填' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: 'reason 必填' });
    }
    const d = getDb();

    const matRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
    if (!matRow) {
      return res.status(404).json({ success: false, error: '材料不存在' });
    }
    const mat: Material = rowToMaterial(matRow);

    d.prepare(`
      UPDATE materials SET status = 'SUSPENDED', has_missing_batch = 1, updated_at = datetime('now') WHERE id = ?
    `).run(materialId);

    const info = d.prepare(`
      INSERT INTO suspend_confirms (material_id, reason, status, created_by)
      VALUES (?, ?, 'OPEN', ?)
    `).run(materialId, reason, operator || '系统');

    AuditService.writeLog({
      materialId,
      materialCode: mat.code,
      operation: 'SUSPEND',
      operator: operator || '系统',
      operatorRole: 'ENGINEER',
      changeDetail: {
        status: { before: mat.status, after: 'SUSPENDED' },
        reason,
      },
    });

    const row = d.prepare('SELECT * FROM suspend_confirms WHERE id = ?').get(info.lastInsertRowid) as any;
    const suspend: SuspendConfirm = rowToSuspendConfirm(row);
    res.status(201).json({ success: true, data: suspend });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/confirm', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效的挂起记录ID' });
    }
    const { pmDecision, pmOpinion, pmSignature, operator } = req.body as {
      pmDecision?: 'CONFIRM_MISSING' | 'SUPPLEMENT_BATCH' | 'REJECT';
      pmOpinion?: string;
      pmSignature?: string;
      operator?: string;
    };
    if (!pmDecision) {
      return res.status(400).json({ success: false, error: 'pmDecision 必填' });
    }
    const valid = ['CONFIRM_MISSING', 'SUPPLEMENT_BATCH', 'REJECT'];
    if (!valid.includes(pmDecision)) {
      return res.status(400).json({ success: false, error: 'pmDecision 无效，必须是 CONFIRM_MISSING / SUPPLEMENT_BATCH / REJECT' });
    }
    const d = getDb();
    const tx = d.transaction(() => {
      const scRow = d.prepare('SELECT * FROM suspend_confirms WHERE id = ?').get(id) as any;
      if (!scRow) return { error: '挂起记录不存在', code: 404 };
      const sc: SuspendConfirm = rowToSuspendConfirm(scRow);

      if (sc.status === 'RESOLVED') {
        return { error: '该挂起记录已确认，不能重复操作', code: 400 };
      }

      const matRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(sc.materialId) as any;
      if (!matRow) return { error: '关联材料不存在', code: 404 };
      const mat: Material = rowToMaterial(matRow);

      let newStatus: string;
      let hasMissingBatchVal: number;
      let operation: 'CONFIRM_MISSING' | 'CONFIRM_BATCH' | 'REJECT';

      if (pmDecision === 'CONFIRM_MISSING') {
        newStatus = 'MISSING';
        hasMissingBatchVal = 1;
        operation = 'CONFIRM_MISSING';
      } else if (pmDecision === 'SUPPLEMENT_BATCH') {
        newStatus = 'PENDING';
        hasMissingBatchVal = 0;
        operation = 'CONFIRM_BATCH';
      } else {
        newStatus = 'PENDING';
        hasMissingBatchVal = mat.hasMissingBatch ? 1 : 0;
        operation = 'REJECT';
      }

      d.prepare(`
        UPDATE suspend_confirms
        SET pm_decision = ?, pm_opinion = ?, pm_signature = ?, status = 'RESOLVED', resolved_at = datetime('now')
        WHERE id = ?
      `).run(pmDecision, pmOpinion ?? null, pmSignature ?? null, id);

      d.prepare(`
        UPDATE materials SET status = ?, has_missing_batch = ?, updated_at = datetime('now') WHERE id = ?
      `).run(newStatus, hasMissingBatchVal, sc.materialId);

      AuditService.writeLog({
        materialId: sc.materialId,
        materialCode: mat.code,
        operation,
        operator: operator || pmSignature || '项目经理',
        operatorRole: 'PM',
        changeDetail: {
          status: { before: mat.status, after: newStatus },
          pmDecision,
          pmOpinion: pmOpinion ?? null,
          pmSignature: pmSignature ?? null,
        },
      });

      const updatedScRow = d.prepare('SELECT * FROM suspend_confirms WHERE id = ?').get(id) as any;
      const updatedMatRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(sc.materialId) as any;
      return {
        suspend: rowToSuspendConfirm(updatedScRow),
        material: rowToMaterial(updatedMatRow),
      };
    });

    const result = tx();
    if ((result as any).error) {
      return res.status((result as any).code || 400).json({ success: false, error: (result as any).error });
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
