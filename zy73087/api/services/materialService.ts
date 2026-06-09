import { v4 as uuidv4 } from 'uuid';
import db, { type DBRowMaterial } from '../db';
import type { Material, MaterialStatus, HistoryAction, HistoryRecord } from '../../shared/types';

function rowToMaterial(row: DBRowMaterial): Material {
  return {
    id: row.id,
    materialCode: row.material_code,
    materialName: row.material_name,
    specification: row.specification,
    quantity: row.quantity,
    unit: row.unit,
    projectName: row.project_name,
    layerCode: row.layer_code,
    position: row.position,
    status: row.status as MaterialStatus,
    collisionPoint: row.collision_point,
    cadNote: row.cad_note,
    cadJudgmentChange: row.cad_judgment_change,
    changeOrderNo: row.change_order_no,
    changeOrderReason: row.change_order_reason,
    changeOrderImpact: row.change_order_impact,
    manualNote: row.manual_note,
    importBatchNo: row.import_batch_no,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHistory(r: any): HistoryRecord {
  let fieldChanges: Record<string, { old: any; new: any }> = {};
  try {
    fieldChanges = JSON.parse(r.field_changes || '{}');
  } catch {
    fieldChanges = {};
  }
  return {
    id: r.id,
    materialId: r.material_id,
    materialCode: r.material_code,
    action: r.action as HistoryAction,
    oldStatus: r.old_status as MaterialStatus | undefined,
    newStatus: r.new_status as MaterialStatus | undefined,
    fieldChanges,
    operator: r.operator,
    remark: r.remark,
    createdAt: r.created_at,
  };
}

export function addHistory(
  materialId: string,
  materialCode: string,
  action: HistoryAction,
  params: {
    oldStatus?: MaterialStatus;
    newStatus?: MaterialStatus;
    fieldChanges?: Record<string, { old: any; new: any }>;
    operator?: string;
    remark?: string;
  } = {},
): void {
  db.insertHistory({
    id: uuidv4(),
    material_id: materialId,
    material_code: materialCode,
    action,
    old_status: params.oldStatus || null,
    new_status: params.newStatus || null,
    field_changes: JSON.stringify(params.fieldChanges || {}),
    operator: params.operator || '阿宁',
    remark: params.remark || '',
    created_at: new Date().toISOString(),
  });
}

export function getMaterials(params: {
  keyword?: string;
  status?: MaterialStatus;
  project?: string;
  layer?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { keyword = '', status, project, layer, page = 1, pageSize = 20 } = params;
  const result = db.queryMaterials({ keyword, status, project, layer, page, pageSize });
  return {
    total: result.total,
    page,
    pageSize,
    data: result.data.map(rowToMaterial),
  };
}

export function getMaterialById(id: string): Material | null {
  const row = db.getMaterialById(id);
  return row ? rowToMaterial(row) : null;
}

export function getMaterialByCode(code: string): Material | null {
  const row = db.getMaterialByCode(code);
  return row ? rowToMaterial(row) : null;
}

export function getHistoryByMaterialId(materialId: string): HistoryRecord[] {
  return db.getHistoryByMaterialId(materialId).map(rowToHistory);
}

export function getHistoryAll(params: {
  action?: HistoryAction;
  keyword?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { action, keyword = '', page = 1, pageSize = 50 } = params;
  const result = db.queryHistory({ action, keyword, page, pageSize });
  return {
    total: result.total,
    page,
    pageSize,
    data: result.data.map(rowToHistory),
  };
}

export function createMaterial(
  input: Partial<Material> & { materialCode: string; materialName: string },
  operator = '阿宁',
): Material {
  const id = input.id || uuidv4();
  const now = new Date().toISOString();
  const row: DBRowMaterial = {
    id,
    material_code: input.materialCode,
    material_name: input.materialName,
    specification: input.specification || '',
    quantity: input.quantity ?? 0,
    unit: input.unit || '',
    project_name: input.projectName || '',
    layer_code: input.layerCode || '',
    position: input.position || '',
    status: input.status || 'pending',
    collision_point: input.collisionPoint || '',
    cad_note: input.cadNote || '',
    cad_judgment_change: input.cadJudgmentChange || '',
    change_order_no: input.changeOrderNo || '',
    change_order_reason: input.changeOrderReason || '',
    change_order_impact: input.changeOrderImpact || '',
    manual_note: input.manualNote || '',
    import_batch_no: input.importBatchNo || '',
    created_at: now,
    updated_at: now,
  };
  db.insertMaterial(row);
  addHistory(id, input.materialCode, 'create', { operator, remark: `新增材料：${input.materialName}` });
  return getMaterialById(id)!;
}

function diffFields(oldObj: Record<string, any>, newObj: Record<string, any>): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};
  for (const k of Object.keys(newObj)) {
    if (oldObj[k] !== newObj[k]) {
      changes[k] = { old: oldObj[k], new: newObj[k] };
    }
  }
  return changes;
}

export function updateMaterial(
  id: string,
  updates: Partial<Material>,
  operator = '阿宁',
  action: HistoryAction = 'update',
  remark?: string,
): Material | null {
  const existing = getMaterialById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const map: Record<string, keyof DBRowMaterial> = {
    materialCode: 'material_code',
    materialName: 'material_name',
    specification: 'specification',
    quantity: 'quantity',
    unit: 'unit',
    projectName: 'project_name',
    layerCode: 'layer_code',
    position: 'position',
    status: 'status',
    collisionPoint: 'collision_point',
    cadNote: 'cad_note',
    cadJudgmentChange: 'cad_judgment_change',
    changeOrderNo: 'change_order_no',
    changeOrderReason: 'change_order_reason',
    changeOrderImpact: 'change_order_impact',
    manualNote: 'manual_note',
    importBatchNo: 'import_batch_no',
  };
  const patch: Partial<DBRowMaterial> = {};
  for (const k of Object.keys(map) as (keyof Material)[]) {
    if (k in updates && (updates as any)[k] !== undefined) {
      (patch as any)[map[k]] = (updates as any)[k];
    }
  }
  if (Object.keys(patch).length === 0) return existing;
  patch.updated_at = now;
  db.updateMaterial(id, patch);

  const changed = diffFields(existing, updates);
  addHistory(id, existing.materialCode, action, {
    oldStatus: updates.status ? existing.status : undefined,
    newStatus: updates.status ? updates.status : undefined,
    fieldChanges: changed,
    operator,
    remark: remark || `更新字段：${Object.keys(changed).join(', ') || '无实质变更'}`,
  });
  return getMaterialById(id);
}

export function rejudgeMaterial(
  id: string,
  newStatus: MaterialStatus,
  reason: string,
  relatedLayer: string,
  collisionDesc: string,
  operator = '阿宁',
): Material | null {
  const existing = getMaterialById(id);
  if (!existing) return null;
  const updates: Partial<Material> = { status: newStatus };
  if (relatedLayer) updates.layerCode = relatedLayer;
  if (collisionDesc) updates.collisionPoint = collisionDesc;
  return updateMaterial(id, updates, operator, 'rejudge', `改判理由：${reason}`);
}

export function updateCadNote(
  id: string,
  cadNote: string,
  cadJudgmentChange: string,
  operator = '阿宁',
): Material | null {
  return updateMaterial(
    id,
    { cadNote, cadJudgmentChange },
    operator,
    'cad_note',
    `补充CAD图层备注，改变的判断：${cadJudgmentChange || '无'}`,
  );
}

export function updateChangeOrder(
  id: string,
  changeOrderNo: string,
  changeOrderReason: string,
  changeOrderImpact: string,
  operator = '阿宁',
): Material | null {
  const existing = getMaterialById(id);
  if (!existing) return null;
  return updateMaterial(
    id,
    {
      changeOrderNo,
      changeOrderReason,
      changeOrderImpact,
      status: existing.status === 'pending' ? 'changing' : existing.status,
    },
    operator,
    'change_order',
    `变更单(${changeOrderNo})晚到补录，影响范围：${changeOrderImpact}`,
  );
}

export function getMaterialStats() {
  return db.getMaterialStats();
}

export function getAllMaterialsForExport(): Material[] {
  return db.getAllMaterials().map(rowToMaterial);
}
