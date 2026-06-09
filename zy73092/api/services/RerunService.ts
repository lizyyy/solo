import { getDb, rowToMaterial, rowToBatch, rowToOpinion } from '../db/database.js';
import type { RerunRequest, MaterialDetail, OpinionSource } from '../../shared/types.js';
import { AuditService } from './AuditService.js';

export class RerunService {
  static rerun(materialId: number, req: RerunRequest): { success: boolean; message?: string; material?: MaterialDetail; newOpinionIds?: number[] } {
    const d = getDb();
    const tx = d.transaction(() => {
      const row = d.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
      if (!row) return { success: false, message: '材料不存在' };
      const material = rowToMaterial(row);

      d.prepare("UPDATE opinions SET is_old_process = 1 WHERE material_id = ? AND is_old_process = 0").run(materialId);

      const oldOpinions = (d.prepare("SELECT source FROM opinions WHERE material_id = ? AND is_old_process = 1 GROUP BY source").all(materialId) as Array<{ source: OpinionSource }>);
      for (const o of oldOpinions) {
        AuditService.writeLog({
          materialId,
          materialCode: material.code,
          operation: 'RERUN',
          operator: req.operator,
          operatorRole: 'ENGINEER',
          changeDetail: { action: 'mark_old_process', source: o.source },
          sourceTag: 'OLD_PROCESS',
        });
      }

      const newOpinionIds: number[] = [];
      if (req.newOpinions && req.newOpinions.length > 0) {
        const insert = d.prepare(`
          INSERT INTO opinions (material_id, source, content, operator, is_old_process)
          VALUES (?, ?, ?, ?, 0)
        `);
        for (const op of req.newOpinions) {
          const info = insert.run(materialId, op.source, op.content, req.operator);
          newOpinionIds.push(Number(info.lastInsertRowid));
          AuditService.writeLog({
            materialId,
            materialCode: material.code,
            operation: 'RERUN',
            operator: req.operator,
            operatorRole: 'ENGINEER',
            changeDetail: { action: 'insert_new_opinion', source: op.source, content: op.content },
            sourceTag: op.source,
          });
        }
      }

      d.prepare("UPDATE materials SET is_latest_export = 0 WHERE id = ?").run(materialId);
      d.prepare(`UPDATE materials SET status = 'PENDING', judge_result = NULL, updated_at = datetime('now') WHERE id = ?`).run(materialId);

      AuditService.writeLog({
        materialId,
        materialCode: material.code,
        operation: 'RERUN',
        operator: req.operator,
        operatorRole: 'ENGINEER',
        changeDetail: {
          status: { before: material.status, after: 'PENDING' },
          judgeResult: { before: material.judgeResult, after: null },
          resetLatestExport: true,
        },
      });

      const afterRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
      const after = rowToMaterial(afterRow);
      const batches = (d.prepare('SELECT * FROM batches WHERE material_id = ? ORDER BY id').all(materialId) as any[]).map(rowToBatch);
      const opinions = (d.prepare('SELECT * FROM opinions WHERE material_id = ? ORDER BY id').all(materialId) as any[]).map(rowToOpinion);
      return { success: true, material: { ...after, batches, opinions }, newOpinionIds };
    });

    return tx();
  }
}
