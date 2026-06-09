import { getDb, rowToBatch, rowToMaterial } from '../db/database.js';
import type { Batch, Material } from '../../shared/types.js';
import { AuditService } from './AuditService.js';

export class BatchService {
  static getByMaterialId(materialId: number): Batch[] {
    const d = getDb();
    const rows = d.prepare('SELECT * FROM batches WHERE material_id = ? ORDER BY id').all(materialId) as any[];
    return rows.map(rowToBatch);
  }

  static scanAndSuspend(materialId: number, operator: string): { material: Material; suspendId: number } | null {
    const d = getDb();
    const tx = d.transaction(() => {
      const materialRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
      if (!materialRow) return null;
      const material = rowToMaterial(materialRow);

      const missingBatches = d.prepare(
        "SELECT * FROM batches WHERE material_id = ? AND status = 'MISSING'"
      ).all(materialId) as any[];

      if (missingBatches.length === 0) return null;

      const reasons = missingBatches
        .map((b: any) => `批次${b.batch_no}${b.missing_reason ? '（' + b.missing_reason + '）' : ''}`)
        .join('；');

      d.prepare(`
        UPDATE materials SET status = 'SUSPENDED', has_missing_batch = 1, updated_at = datetime('now') WHERE id = ?
      `).run(materialId);

      const suspendInfo = d.prepare(`
        INSERT INTO suspend_confirms (material_id, reason, status, created_by)
        VALUES (?, ?, 'OPEN', ?)
      `).run(materialId, `批次缺失：${reasons}`, operator);

      AuditService.writeLog({
        materialId,
        materialCode: material.code,
        operation: 'SUSPEND',
        operator,
        operatorRole: 'ENGINEER',
        changeDetail: {
          status: { before: material.status, after: 'SUSPENDED' },
          missingBatches: missingBatches.map((b: any) => b.batch_no),
          reason: reasons,
        },
      });

      const updatedRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
      return { material: rowToMaterial(updatedRow), suspendId: Number(suspendInfo.lastInsertRowid) };
    });

    return tx();
  }
}
