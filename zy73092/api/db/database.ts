import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  Material,
  Batch,
  Opinion,
  AuditLog,
  SuspendConfirm,
  Specialty,
  MaterialStatus,
  JudgeResult,
  OpinionSource,
  OperationType,
} from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'mep-tracker.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      spec TEXT,
      specialty TEXT NOT NULL CHECK(specialty IN ('HVAC','ELECTRICAL','PLUMBING','FIRE')),
      submission_no TEXT,
      source_form TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      judge_result TEXT,
      is_latest_export INTEGER DEFAULT 0,
      has_missing_batch INTEGER DEFAULT 0,
      import_time TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_materials_specialty ON materials(specialty);

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      batch_no TEXT NOT NULL,
      arrival_date TEXT,
      inspect_report INTEGER DEFAULT 0,
      quality_cert INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'COMPLETE',
      missing_reason TEXT,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS opinions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      operator TEXT,
      is_old_process INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_opinions_material ON opinions(material_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER,
      material_code TEXT,
      operation TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      change_detail TEXT,
      source_tag TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_material ON audit_logs(material_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS suspend_confirms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      pm_decision TEXT,
      pm_opinion TEXT,
      pm_signature TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY(material_id) REFERENCES materials(id)
    );
  `);
}

interface MaterialRow {
  id: number;
  code: string;
  name: string;
  spec: string;
  specialty: Specialty;
  submission_no: string;
  source_form: string;
  status: MaterialStatus;
  judge_result: JudgeResult | null;
  is_latest_export: number;
  has_missing_batch: number;
  import_time: string;
  created_at: string;
  updated_at: string;
}

interface BatchRow {
  id: number;
  material_id: number;
  batch_no: string;
  arrival_date: string | null;
  inspect_report: number;
  quality_cert: number;
  status: 'COMPLETE' | 'MISSING';
  missing_reason: string | null;
}

interface OpinionRow {
  id: number;
  material_id: number;
  source: OpinionSource;
  content: string;
  operator: string;
  is_old_process: number;
  created_at: string;
}

interface AuditLogRow {
  id: number;
  material_id: number | null;
  material_code: string;
  operation: OperationType;
  operator: string;
  operator_role: 'ENGINEER' | 'PM';
  change_detail: string;
  source_tag: OpinionSource | null;
  created_at: string;
}

interface SuspendConfirmRow {
  id: number;
  material_id: number;
  reason: string;
  pm_decision: 'CONFIRM_MISSING' | 'SUPPLEMENT_BATCH' | 'REJECT' | null;
  pm_opinion: string | null;
  pm_signature: string | null;
  status: 'OPEN' | 'RESOLVED';
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

export function rowToMaterial(r: MaterialRow): Material {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    spec: r.spec,
    specialty: r.specialty,
    submissionNo: r.submission_no,
    sourceForm: r.source_form,
    status: r.status,
    judgeResult: r.judge_result,
    isLatestExport: r.is_latest_export === 1,
    hasMissingBatch: r.has_missing_batch === 1,
    importTime: r.import_time,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToBatch(r: BatchRow): Batch {
  return {
    id: r.id,
    materialId: r.material_id,
    batchNo: r.batch_no,
    arrivalDate: r.arrival_date,
    inspectReport: r.inspect_report === 1,
    qualityCert: r.quality_cert === 1,
    status: r.status,
    missingReason: r.missing_reason,
  };
}

export function rowToOpinion(r: OpinionRow): Opinion {
  return {
    id: r.id,
    materialId: r.material_id,
    source: r.source,
    content: r.content,
    operator: r.operator,
    isOldProcess: r.is_old_process === 1,
    createdAt: r.created_at,
  };
}

export function rowToAuditLog(r: AuditLogRow): AuditLog {
  return {
    id: r.id,
    materialId: r.material_id,
    materialCode: r.material_code,
    operation: r.operation,
    operator: r.operator,
    operatorRole: r.operator_role,
    changeDetail: r.change_detail,
    sourceTag: r.source_tag,
    createdAt: r.created_at,
  };
}

export function rowToSuspendConfirm(r: SuspendConfirmRow): SuspendConfirm {
  return {
    id: r.id,
    materialId: r.material_id,
    reason: r.reason,
    pmDecision: r.pm_decision,
    pmOpinion: r.pm_opinion,
    pmSignature: r.pm_signature,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function seedIfEmpty(): void {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) as c FROM materials').get() as { c: number };
  if (count.c > 0) return;

  const insertMaterial = d.prepare(`
    INSERT INTO materials (code, name, spec, specialty, submission_no, source_form, status, judge_result, is_latest_export, has_missing_batch, import_time)
    VALUES (@code, @name, @spec, @specialty, @submission_no, @source_form, @status, @judge_result, @is_latest_export, @has_missing_batch, @import_time)
  `);
  const insertBatch = d.prepare(`
    INSERT INTO batches (material_id, batch_no, arrival_date, inspect_report, quality_cert, status, missing_reason)
    VALUES (@material_id, @batch_no, @arrival_date, @inspect_report, @quality_cert, @status, @missing_reason)
  `);
  const insertOpinion = d.prepare(`
    INSERT INTO opinions (material_id, source, content, operator, is_old_process)
    VALUES (@material_id, @source, @content, @operator, @is_old_process)
  `);
  const insertAudit = d.prepare(`
    INSERT INTO audit_logs (material_id, material_code, operation, operator, operator_role, change_detail, source_tag)
    VALUES (@material_id, @material_code, @operation, @operator, @operator_role, @change_detail, @source_tag)
  `);
  const insertSuspend = d.prepare(`
    INSERT INTO suspend_confirms (material_id, reason, pm_decision, pm_opinion, pm_signature, status, created_by, resolved_at)
    VALUES (@material_id, @reason, @pm_decision, @pm_opinion, @pm_signature, @status, @created_by, @resolved_at)
  `);

  const importTime = '2026-03-15 09:30:00';

  const seed = d.transaction(() => {
    // ===== M1: MEP-HV-001 镀锌钢板，PROCESSED PASS =====
    const m1Info = insertMaterial.run({
      code: 'MEP-HV-001',
      name: '镀锌钢板',
      spec: 'δ=1.2mm',
      specialty: 'HVAC',
      submission_no: 'SS-2026-001',
      source_form: '机电送审表2026-03',
      status: 'PROCESSED',
      judge_result: 'PASS',
      is_latest_export: 1,
      has_missing_batch: 0,
      import_time: importTime,
    });
    const m1Id = Number(m1Info.lastInsertRowid);
    insertBatch.run({ material_id: m1Id, batch_no: 'B20260301', arrival_date: '2026-03-01', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertBatch.run({ material_id: m1Id, batch_no: 'B20260310', arrival_date: '2026-03-10', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertOpinion.run({ material_id: m1Id, source: 'HANDOVER_LIST', content: '规格符合设计要求，厚度达标', operator: '王工', is_old_process: 0 });
    insertOpinion.run({ material_id: m1Id, source: 'SUBMISSION_FORM', content: '资料齐全，通过审核', operator: '李工', is_old_process: 0 });
    insertOpinion.run({ material_id: m1Id, source: 'OLD_PROCESS', content: '2025年同期批次合格，历史记录良好', operator: '系统', is_old_process: 1 });
    insertAudit.run({
      material_id: m1Id,
      material_code: 'MEP-HV-001',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-03' }),
      source_tag: null,
    });

    // ===== M2: MEP-EL-002 阻燃电缆，PENDING =====
    const m2Info = insertMaterial.run({
      code: 'MEP-EL-002',
      name: '阻燃电缆',
      spec: 'ZR-YJV-4x16',
      specialty: 'ELECTRICAL',
      submission_no: 'SS-2026-002',
      source_form: '机电送审表2026-03',
      status: 'PENDING',
      judge_result: null,
      is_latest_export: 0,
      has_missing_batch: 0,
      import_time: importTime,
    });
    const m2Id = Number(m2Info.lastInsertRowid);
    insertBatch.run({ material_id: m2Id, batch_no: 'B20260305', arrival_date: '2026-03-05', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertOpinion.run({ material_id: m2Id, source: 'HANDOVER_LIST', content: '通过', operator: '王工', is_old_process: 0 });
    insertOpinion.run({ material_id: m2Id, source: 'SUBMISSION_FORM', content: '需补充3C报告', operator: '李工', is_old_process: 0 });
    insertAudit.run({
      material_id: m2Id,
      material_code: 'MEP-EL-002',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-03' }),
      source_tag: null,
    });

    // ===== M3: MEP-PL-003 PPR给水管，PENDING — 边界样本1 =====
    const m3Info = insertMaterial.run({
      code: 'MEP-PL-003',
      name: 'PPR给水管',
      spec: 'De25',
      specialty: 'PLUMBING',
      submission_no: 'SS-2026-003',
      source_form: '机电送审表2026-04',
      status: 'PENDING',
      judge_result: null,
      is_latest_export: 0,
      has_missing_batch: 0,
      import_time: '2026-04-02 10:15:00',
    });
    const m3Id = Number(m3Info.lastInsertRowid);
    insertBatch.run({ material_id: m3Id, batch_no: 'B20260401', arrival_date: '2026-04-01', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertOpinion.run({ material_id: m3Id, source: 'HANDOVER_LIST', content: '符合国标', operator: '张工', is_old_process: 0 });
    insertOpinion.run({ material_id: m3Id, source: 'SUBMISSION_FORM', content: '需提供卫生许可（旧交底清单漏写）', operator: '刘工', is_old_process: 0 });
    insertAudit.run({
      material_id: m3Id,
      material_code: 'MEP-PL-003',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-04', isBoundarySample: true, note: '交底清单遗漏卫生许可要求' }),
      source_tag: null,
    });

    // ===== M4: MEP-FR-004 喷淋头，SUSPENDED — 边界样本2 =====
    const m4Info = insertMaterial.run({
      code: 'MEP-FR-004',
      name: '喷淋头',
      spec: 'DN15 68℃',
      specialty: 'FIRE',
      submission_no: 'SS-2026-004',
      source_form: '机电送审表2026-04',
      status: 'SUSPENDED',
      judge_result: null,
      is_latest_export: 0,
      has_missing_batch: 1,
      import_time: '2026-04-10 14:00:00',
    });
    const m4Id = Number(m4Info.lastInsertRowid);
    insertBatch.run({ material_id: m4Id, batch_no: 'B20260310', arrival_date: '2026-03-10', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertBatch.run({ material_id: m4Id, batch_no: 'B20260315', arrival_date: null, inspect_report: 0, quality_cert: 0, status: 'MISSING', missing_reason: '供应商未提供，待追补' });
    insertBatch.run({ material_id: m4Id, batch_no: 'B20260320', arrival_date: '2026-03-20', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertOpinion.run({ material_id: m4Id, source: 'HANDOVER_LIST', content: '规格符合消防要求', operator: '陈工', is_old_process: 0 });
    insertOpinion.run({ material_id: m4Id, source: 'SUBMISSION_FORM', content: '送检报告待补', operator: '赵工', is_old_process: 0 });
    insertSuspend.run({
      material_id: m4Id,
      reason: '批次B20260315缺失质检报告，原因：供应商未提供，待追补',
      pm_decision: null,
      pm_opinion: null,
      pm_signature: null,
      status: 'OPEN',
      created_by: '陈工',
      resolved_at: null,
    });
    insertAudit.run({
      material_id: m4Id,
      material_code: 'MEP-FR-004',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-04', isBoundarySample: true, note: '批次B20260315缺失' }),
      source_tag: null,
    });
    insertAudit.run({
      material_id: m4Id,
      material_code: 'MEP-FR-004',
      operation: 'SUSPEND',
      operator: '陈工',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ status: { before: 'PENDING', after: 'SUSPENDED' }, missingBatch: 'B20260315' }),
      source_tag: null,
    });

    // ===== M5: MEP-HV-005 消声器，MISSING — 已RESOLVED挂起 =====
    const m5Info = insertMaterial.run({
      code: 'MEP-HV-005',
      name: '消声器',
      spec: '1200x600',
      specialty: 'HVAC',
      submission_no: 'SS-2026-005',
      source_form: '机电送审表2026-05',
      status: 'MISSING',
      judge_result: null,
      is_latest_export: 0,
      has_missing_batch: 1,
      import_time: '2026-05-05 09:00:00',
    });
    const m5Id = Number(m5Info.lastInsertRowid);
    insertBatch.run({ material_id: m5Id, batch_no: 'B20260501', arrival_date: null, inspect_report: 0, quality_cert: 0, status: 'MISSING', missing_reason: '供应商延期交货' });
    insertOpinion.run({ material_id: m5Id, source: 'HANDOVER_LIST', content: '按图纸型号订货', operator: '王工', is_old_process: 0 });
    insertSuspend.run({
      material_id: m5Id,
      reason: '批次B20260501全部缺失，供应商延期交货',
      pm_decision: 'CONFIRM_MISSING',
      pm_opinion: '确认缺材料，等供应商补发',
      pm_signature: '李经理',
      status: 'RESOLVED',
      created_by: '王工',
      resolved_at: '2026-05-08 15:30:00',
    });
    insertAudit.run({
      material_id: m5Id,
      material_code: 'MEP-HV-005',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-05' }),
      source_tag: null,
    });
    insertAudit.run({
      material_id: m5Id,
      material_code: 'MEP-HV-005',
      operation: 'SUSPEND',
      operator: '王工',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ status: { before: 'PENDING', after: 'SUSPENDED' }, missingBatch: 'B20260501' }),
      source_tag: null,
    });
    insertAudit.run({
      material_id: m5Id,
      material_code: 'MEP-HV-005',
      operation: 'CONFIRM_MISSING',
      operator: '李经理',
      operator_role: 'PM',
      change_detail: JSON.stringify({ status: { before: 'SUSPENDED', after: 'MISSING' }, pmOpinion: '确认缺材料，等供应商补发' }),
      source_tag: null,
    });

    // ===== M6: MEP-EL-006 配电箱，AWAITING_PM — OPEN挂起 =====
    const m6Info = insertMaterial.run({
      code: 'MEP-EL-006',
      name: '配电箱',
      spec: 'AL-1',
      specialty: 'ELECTRICAL',
      submission_no: 'SS-2026-006',
      source_form: '机电送审表2026-05',
      status: 'AWAITING_PM',
      judge_result: null,
      is_latest_export: 0,
      has_missing_batch: 1,
      import_time: '2026-05-20 11:00:00',
    });
    const m6Id = Number(m6Info.lastInsertRowid);
    insertBatch.run({ material_id: m6Id, batch_no: 'B20260515', arrival_date: '2026-05-15', inspect_report: 1, quality_cert: 1, status: 'COMPLETE', missing_reason: null });
    insertBatch.run({ material_id: m6Id, batch_no: 'B20260518', arrival_date: null, inspect_report: 0, quality_cert: 0, status: 'MISSING', missing_reason: '厂家未提供出厂合格证' });
    insertOpinion.run({ material_id: m6Id, source: 'HANDOVER_LIST', content: '箱内元器件符合清单', operator: '孙工', is_old_process: 0 });
    insertSuspend.run({
      material_id: m6Id,
      reason: '批次B20260518缺失出厂合格证',
      pm_decision: null,
      pm_opinion: null,
      pm_signature: null,
      status: 'OPEN',
      created_by: '孙工',
      resolved_at: null,
    });
    insertAudit.run({
      material_id: m6Id,
      material_code: 'MEP-EL-006',
      operation: 'IMPORT',
      operator: '系统',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ action: 'import', source: '机电送审表2026-05' }),
      source_tag: null,
    });
    insertAudit.run({
      material_id: m6Id,
      material_code: 'MEP-EL-006',
      operation: 'SUSPEND',
      operator: '孙工',
      operator_role: 'ENGINEER',
      change_detail: JSON.stringify({ status: { before: 'PENDING', after: 'AWAITING_PM' }, missingBatch: 'B20260518' }),
      source_tag: null,
    });
  });

  seed();
}
