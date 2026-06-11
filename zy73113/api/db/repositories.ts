import { db } from './index';
import { v4 as uuidv4 } from 'uuid';
import type { Plan, HistoryVersion, MaterialBatch, PlanStatus, Judgment, OperationType } from '../../shared/types';

function rowToPlan(row: any): Plan {
  return {
    id: row.id,
    planNo: row.plan_no,
    projectName: row.project_name,
    originalOpinion: row.original_opinion,
    originalSource: row.original_source,
    currentRemark: row.current_remark,
    judgment: row.judgment as Judgment,
    status: row.status as PlanStatus,
    materialBatch: row.material_batch,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function rowToHistory(row: any): HistoryVersion {
  return {
    id: row.id,
    planId: row.plan_id,
    version: row.version,
    operationType: row.operation_type as OperationType,
    oldValue: row.old_value,
    newValue: row.new_value,
    changeReason: row.change_reason,
    operator: row.operator,
    timestamp: row.timestamp,
  };
}

function rowToMaterial(row: any): MaterialBatch {
  return {
    id: row.id,
    planId: row.plan_id,
    batchNo: row.batch_no,
    materialName: row.material_name,
    quantity: row.quantity,
    isSupplement: row.is_supplement === 1,
    supplementReason: row.supplement_reason,
    recordedAt: row.recorded_at,
  };
}

export const planRepository = {
  findAll(params: { status?: PlanStatus; keyword?: string } = {}): Plan[] {
    let sql = 'SELECT * FROM plans WHERE 1=1';
    const args: any[] = [];

    if (params.status) {
      sql += ' AND status = ?';
      args.push(params.status);
    }

    if (params.keyword) {
      sql += ' AND (plan_no LIKE ? OR project_name LIKE ? OR original_opinion LIKE ?)';
      const keyword = `%${params.keyword}%`;
      args.push(keyword, keyword, keyword);
    }

    sql += ' ORDER BY updated_at DESC';
    const rows = db.prepare(sql).all(...args);
    return rows.map(rowToPlan);
  },

  findById(id: string): Plan | null {
    const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    return row ? rowToPlan(row) : null;
  },

  findByPlanNo(planNo: string): Plan | null {
    const row = db.prepare('SELECT * FROM plans WHERE plan_no = ?').get(planNo);
    return row ? rowToPlan(row) : null;
  },

  create(data: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Plan {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO plans (id, plan_no, project_name, original_opinion, original_source, 
                         current_remark, judgment, status, material_batch, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.planNo,
      data.projectName,
      data.originalOpinion,
      data.originalSource,
      data.currentRemark,
      data.judgment,
      data.status,
      data.materialBatch,
      now,
      now,
      data.createdBy
    );

    return this.findById(id)!;
  },

  updateRemark(id: string, remark: string): void {
    db.prepare(`
      UPDATE plans SET current_remark = ?, updated_at = ? WHERE id = ?
    `).run(remark, new Date().toISOString(), id);
  },

  updateJudgment(id: string, judgment: Judgment): void {
    db.prepare(`
      UPDATE plans SET judgment = ?, updated_at = ? WHERE id = ?
    `).run(judgment, new Date().toISOString(), id);
  },

  updateStatus(id: string, status: PlanStatus): void {
    db.prepare(`
      UPDATE plans SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);
  },

  updateMaterialBatch(id: string, materialBatch: string): void {
    db.prepare(`
      UPDATE plans SET material_batch = ?, updated_at = ? WHERE id = ?
    `).run(materialBatch, new Date().toISOString(), id);
  },
};

export const historyRepository = {
  findByPlanId(planId: string): HistoryVersion[] {
    const rows = db.prepare(`
      SELECT * FROM history_versions 
      WHERE plan_id = ? 
      ORDER BY timestamp DESC
    `).all(planId);
    return rows.map(rowToHistory);
  },

  create(data: Omit<HistoryVersion, 'id' | 'timestamp'>): HistoryVersion {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO history_versions (id, plan_id, version, operation_type, old_value, 
                                     new_value, change_reason, operator, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.planId,
      data.version,
      data.operationType,
      data.oldValue,
      data.newValue,
      data.changeReason,
      data.operator,
      now
    );

    const row = db.prepare('SELECT * FROM history_versions WHERE id = ?').get(id);
    return rowToHistory(row);
  },

  getNextVersion(planId: string, operationType: OperationType): string {
    const prefixMap: Record<OperationType, string> = {
      create: 'V',
      remark_update: 'R',
      judgment_change: 'J',
      material_add: 'M',
      status_change: 'S',
    };

    const prefix = prefixMap[operationType];
    const rows = db.prepare(`
      SELECT version FROM history_versions 
      WHERE plan_id = ? AND version LIKE ?
      ORDER BY version DESC
      LIMIT 1
    `).all(planId, `${prefix}%`);

    if (rows.length === 0) {
      return `${prefix}1`;
    }

    const lastVersion = (rows[0] as { version: string }).version;
    const num = parseInt(lastVersion.slice(1), 10);
    return `${prefix}${num + 1}`;
  },
};

export const materialRepository = {
  findByPlanId(planId: string): MaterialBatch[] {
    const rows = db.prepare(`
      SELECT * FROM material_batches 
      WHERE plan_id = ? 
      ORDER BY recorded_at DESC
    `).all(planId);
    return rows.map(rowToMaterial);
  },

  create(data: Omit<MaterialBatch, 'id' | 'recordedAt'>): MaterialBatch {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO material_batches (id, plan_id, batch_no, material_name, quantity, 
                                     is_supplement, supplement_reason, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.planId,
      data.batchNo,
      data.materialName,
      data.quantity,
      data.isSupplement ? 1 : 0,
      data.supplementReason,
      now
    );

    const row = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(id);
    return rowToMaterial(row);
  },
};
