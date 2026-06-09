import { getDb, rowToMaterial, rowToBatch, rowToOpinion } from '../db/database.js';
import type { Material, Batch, Opinion, JudgeRequest, MaterialStatus, ImportItem } from '../../shared/types.js';
import { AuditService } from './AuditService.js';

const SUSPEND_STATUSES: MaterialStatus[] = ['SUSPENDED', 'MISSING', 'AWAITING_PM'];

export interface MaterialFilters {
  status?: MaterialStatus;
  specialty?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface MaterialDetail extends Material {
  batches: Batch[];
  opinions: Opinion[];
}

export class MaterialService {
  static getMaterials(filters: MaterialFilters = {}) {
    const d = getDb();
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.status) {
      clauses.push('status = @status');
      params.status = filters.status;
    }
    if (filters.specialty) {
      clauses.push('specialty = @specialty');
      params.specialty = filters.specialty;
    }
    if (filters.search) {
      clauses.push('(code LIKE @search OR name LIKE @search OR spec LIKE @search OR submission_no LIKE @search)');
      params.search = `%${filters.search}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const totalRow = d.prepare(`SELECT COUNT(*) as c FROM materials ${where}`).get(params) as { c: number };
    const rows = d.prepare(
      `SELECT * FROM materials ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: pageSize, offset }) as any[];

    return {
      items: rows.map(rowToMaterial),
      total: totalRow.c,
      page,
      pageSize,
      totalPages: Math.ceil(totalRow.c / pageSize),
    };
  }

  static getById(id: number): MaterialDetail | null {
    const d = getDb();
    const row = d.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
    if (!row) return null;
    const material = rowToMaterial(row);
    const batches = (d.prepare('SELECT * FROM batches WHERE material_id = ? ORDER BY id').all(id) as any[]).map(rowToBatch);
    const opinions = (d.prepare('SELECT * FROM opinions WHERE material_id = ? ORDER BY id').all(id) as any[]).map(rowToOpinion);
    return { ...material, batches, opinions };
  }

  static judge(id: number, req: JudgeRequest): { success: boolean; message?: string; material?: MaterialDetail } {
    const d = getDb();
    const tx = d.transaction(() => {
      const row = d.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
      if (!row) return { success: false, message: '材料不存在' };
      const before = rowToMaterial(row);

      if (SUSPEND_STATUSES.includes(before.status)) {
        return { success: false, message: '批次缺失，需项目经理确认后才能改判' };
      }

      d.prepare(`
        UPDATE materials
        SET judge_result = ?, status = 'PROCESSED', updated_at = datetime('now')
        WHERE id = ?
      `).run(req.judgeResult, id);

      if (req.isLatestExport) {
        d.prepare("UPDATE materials SET is_latest_export = 0 WHERE id != ?").run(id);
        d.prepare("UPDATE materials SET is_latest_export = 1 WHERE id = ?").run(id);
      }

      if (req.supplementNote && req.supplementNote.trim()) {
        d.prepare(`
          INSERT INTO opinions (material_id, source, content, operator, is_old_process)
          VALUES (?, 'SUPPLEMENT_NOTE', ?, ?, 0)
        `).run(id, req.supplementNote.trim(), req.operator);
      }

      AuditService.writeLog({
        materialId: id,
        materialCode: before.code,
        operation: 'JUDGE',
        operator: req.operator,
        operatorRole: 'ENGINEER',
        changeDetail: {
          status: { before: before.status, after: 'PROCESSED' },
          judgeResult: { before: before.judgeResult, after: req.judgeResult },
          isLatestExport: req.isLatestExport,
          supplementNote: req.supplementNote ?? null,
        },
        sourceTag: req.isLatestExport ? 'LATEST_EXPORT' : null,
      });

      if (req.supplementNote && req.supplementNote.trim()) {
        AuditService.writeLog({
          materialId: id,
          materialCode: before.code,
          operation: 'NOTE',
          operator: req.operator,
          operatorRole: 'ENGINEER',
          changeDetail: { content: req.supplementNote.trim() },
          sourceTag: 'SUPPLEMENT_NOTE',
        });
      }

      const afterRow = d.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
      const after = rowToMaterial(afterRow);
      const batches = (d.prepare('SELECT * FROM batches WHERE material_id = ? ORDER BY id').all(id) as any[]).map(rowToBatch);
      const opinions = (d.prepare('SELECT * FROM opinions WHERE material_id = ? ORDER BY id').all(id) as any[]).map(rowToOpinion);
      return { success: true, material: { ...after, batches, opinions } };
    });

    return tx();
  }

  static importItems(items: ImportItem[], operator = '系统'): { success: boolean; imported: number; skipped: number; results: Array<{ code: string; status: string; message?: string; materialId?: number }> } {
    const d = getDb();
    const results: Array<{ code: string; status: string; message?: string; materialId?: number }> = [];
    let imported = 0;
    let skipped = 0;

    const tx = d.transaction(() => {
      for (const item of items) {
        const existing = d.prepare('SELECT id FROM materials WHERE code = ?').get(item.code) as any;
        if (existing) {
          skipped++;
          results.push({ code: item.code, status: 'skipped', message: '材料编号已存在' });
          continue;
        }

        const hasMissingBatch = item.batches.some((b) => b.isMissing);

        const info = d.prepare(`
          INSERT INTO materials (code, name, spec, specialty, submission_no, source_form, status, has_missing_batch, import_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          item.code,
          item.name,
          item.spec,
          item.specialty,
          item.submissionNo,
          item.sourceForm,
          hasMissingBatch ? 'SUSPENDED' : 'PENDING',
          hasMissingBatch ? 1 : 0,
        );

        const materialId = Number(info.lastInsertRowid);

        for (const b of item.batches) {
          d.prepare(`
            INSERT INTO batches (material_id, batch_no, inspect_report, quality_cert, status, missing_reason)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            materialId,
            b.batchNo,
            b.inspectReport ? 1 : 0,
            b.qualityCert ? 1 : 0,
            b.isMissing ? 'MISSING' : 'COMPLETE',
            b.missingReason ?? null,
          );
        }

        d.prepare(`
          INSERT INTO opinions (material_id, source, content, operator, is_old_process)
          VALUES (?, 'HANDOVER_LIST', ?, ?, 0)
        `).run(materialId, item.handoverOpinion, operator);

        d.prepare(`
          INSERT INTO opinions (material_id, source, content, operator, is_old_process)
          VALUES (?, 'SUBMISSION_FORM', ?, ?, 0)
        `).run(materialId, item.submissionOpinion, operator);

        if (hasMissingBatch) {
          const missing = item.batches.filter((b) => b.isMissing);
          const reason = missing.map((b) => `批次${b.batchNo}${b.missingReason ? '（' + b.missingReason + '）' : ''}`).join('；');
          d.prepare(`
            INSERT INTO suspend_confirms (material_id, reason, status, created_by)
            VALUES (?, ?, 'OPEN', ?)
          `).run(materialId, `批次缺失：${reason}`, operator);
        }

        AuditService.writeLog({
          materialId,
          materialCode: item.code,
          operation: 'IMPORT',
          operator,
          operatorRole: 'ENGINEER',
          changeDetail: {
            source: item.sourceForm,
            isBoundarySample: item.isBoundarySample ?? false,
            batches: item.batches.length,
            hasMissingBatch,
          },
        });

        imported++;
        results.push({ code: item.code, status: 'imported', materialId });
      }
    });

    tx();
    return { success: true, imported, skipped, results };
  }
}
