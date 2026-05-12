import db from '../db';
import { v4 as uuidv4 } from 'uuid';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWING' | 'REJECTED' | 'SUPPLEMENT' | 'SENT' | 'RETURNED' | 'APPROVED' | 'CLOSED';
export type MaterialStatus = 'PENDING' | 'UPLOADED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Application {
  id: string;
  tourist_id: string;
  country_id: string;
  status: ApplicationStatus;
  submitted_at?: number;
  reviewed_at?: number;
  sent_at?: number;
  returned_at?: number;
  closed_at?: number;
  created_at: number;
}

export interface Material {
  id: string;
  application_id: string;
  type_id: string;
  version: number;
  status: MaterialStatus;
  file_url?: string;
  remark?: string;
  expire_at?: number;
  uploaded_at: number;
  reviewed_at?: number;
  reviewer_note?: string;
}

const recordStatusHistory = (applicationId: string, fromStatus: string | null, toStatus: string, remark?: string, operator?: string) => {
  const stmt = db.prepare(`
    INSERT INTO status_history (id, application_id, from_status, to_status, remark, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(uuidv4(), applicationId, fromStatus, toStatus, remark || null, operator || null);
};

export const createApplication = (touristId: string, countryId: string): Application => {
  const existing = db.prepare(`
    SELECT id FROM applications 
    WHERE tourist_id = ? AND country_id = ? AND status NOT IN ('CLOSED', 'APPROVED')
  `).get() as Application | undefined;

  if (existing) {
    throw new Error('该游客已有进行中的签证申请');
  }

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO applications (id, tourist_id, country_id, status)
    VALUES (?, ?, ?, 'DRAFT')
  `);
  stmt.run(id, touristId, countryId);
  
  recordStatusHistory(id, null, 'DRAFT', '创建申请');

  const materialTypes = db.prepare(`
    SELECT id FROM material_types WHERE country_id = ?
  `).all() as { id: string }[];

  const materialStmt = db.prepare(`
    INSERT INTO materials (id, application_id, type_id, version, status)
    VALUES (?, ?, ?, 1, 'PENDING')
  `);

  for (const type of materialTypes) {
    materialStmt.run(uuidv4(), id, type.id);
  }

  return getApplication(id)!;
};

export const getApplication = (id: string): Application | undefined => {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application | undefined;
};

export const getApplicationMaterials = (applicationId: string) => {
  return db.prepare(`
    SELECT m.*, mt.name as type_name, mt.required, mt.validity_days
    FROM materials m
    JOIN material_types mt ON m.type_id = mt.id
    WHERE m.application_id = ?
    ORDER BY mt.required DESC, mt.name
  `).all(applicationId);
};

export const submitApplication = (applicationId: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (app.status !== 'DRAFT' && app.status !== 'SUPPLEMENT') {
    throw new Error('当前状态不允许提交');
  }

  const materials = getApplicationMaterials(applicationId);
  const now = Math.floor(Date.now() / 1000);
  
  for (const m of materials as any[]) {
    if (m.required && m.status === 'PENDING') {
      throw new Error(`必填材料「${m.type_name}」未上传，无法提交`);
    }
    if (m.expire_at && m.expire_at < now) {
      throw new Error(`材料「${m.type_name}」已过期，请重新上传`);
    }
  }

  const stmt = db.prepare(`
    UPDATE applications 
    SET status = 'SUBMITTED', submitted_at = ?
    WHERE id = ?
  `);
  stmt.run(now, applicationId);
  
  recordStatusHistory(applicationId, app.status, 'SUBMITTED', '提交申请', operator);

  db.prepare(`
    UPDATE materials SET status = 'REVIEWING'
    WHERE application_id = ? AND status = 'UPLOADED'
  `).run(applicationId);

  return getApplication(applicationId);
};

export const startReview = (applicationId: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (app.status !== 'SUBMITTED') {
    throw new Error('只有已提交的申请可以开始审核');
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE applications SET status = 'REVIEWING', reviewed_at = ? WHERE id = ?
  `).run(now, applicationId);
  
  recordStatusHistory(applicationId, 'SUBMITTED', 'REVIEWING', '开始审核', operator);

  return getApplication(applicationId);
};

export const sendToVisa = (applicationId: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (app.status !== 'REVIEWING') {
    throw new Error('只有审核中的申请可以送签');
  }

  const materials = getApplicationMaterials(applicationId);
  for (const m of materials as any[]) {
    if (m.required && m.status !== 'APPROVED') {
      throw new Error(`必填材料「${m.type_name}」未通过审核，无法送签`);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE applications SET status = 'SENT', sent_at = ? WHERE id = ?
  `).run(now, applicationId);
  
  recordStatusHistory(applicationId, 'REVIEWING', 'SENT', '送签', operator);

  return getApplication(applicationId);
};

export const returnApplication = (applicationId: string, reason: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (app.status !== 'SENT') {
    throw new Error('只有已送签的申请可以退回');
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE applications SET status = 'RETURNED', returned_at = ? WHERE id = ?
  `).run(now, applicationId);
  
  recordStatusHistory(applicationId, 'SENT', 'RETURNED', `退回: ${reason}`, operator);

  return getApplication(applicationId);
};

export const requestSupplement = (applicationId: string, materialId: string, reason: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (!['REVIEWING', 'RETURNED'].includes(app.status)) {
    throw new Error('当前状态不允许要求补件');
  }

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as Material | undefined;
  if (!material) throw new Error('材料不存在');
  if (material.application_id !== applicationId) {
    throw new Error('材料不属于该申请');
  }

  const existingPending = db.prepare(`
    SELECT id FROM supplement_requests 
    WHERE material_id = ? AND status = 'PENDING'
  `).get(materialId);
  
  if (existingPending) {
    throw new Error('该材料已有待处理的补件请求');
  }

  const requestId = uuidv4();
  db.prepare(`
    INSERT INTO supplement_requests (id, application_id, material_id, reason)
    VALUES (?, ?, ?, ?)
  `).run(requestId, applicationId, materialId, reason);

  db.prepare(`
    UPDATE materials SET status = 'REJECTED' WHERE id = ?
  `).run(materialId);

  if (app.status !== 'SUPPLEMENT') {
    db.prepare(`
      UPDATE applications SET status = 'SUPPLEMENT' WHERE id = ?
    `).run(applicationId);
    recordStatusHistory(applicationId, app.status, 'SUPPLEMENT', `需要补件: ${reason}`, operator);
  }

  return { requestId, application: getApplication(applicationId) };
};

export const getMissingMaterials = (applicationId: string) => {
  const materials = getApplicationMaterials(applicationId);
  const now = Math.floor(Date.now() / 1000);
  
  const missing = [];
  const expired = [];
  const rejected = [];

  for (const m of materials as any[]) {
    if (m.expire_at && m.expire_at < now && m.status !== 'PENDING') {
      expired.push({ ...m, current_status: 'EXPIRED' });
    } else if (m.required && (m.status === 'PENDING' || m.status === 'REJECTED')) {
      if (m.status === 'REJECTED') {
        rejected.push(m);
      } else {
        missing.push(m);
      }
    }
  }

  return { missing, expired, rejected, total: missing.length + expired.length + rejected.length };
};

export const getApplicationStatusHistory = (applicationId: string) => {
  return db.prepare(`
    SELECT * FROM status_history 
    WHERE application_id = ? 
    ORDER BY created_at DESC
  `).all(applicationId);
};

export const closeApplication = (applicationId: string, reason: string, operator?: string) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (app.status === 'CLOSED') {
    throw new Error('申请已关闭');
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE applications SET status = 'CLOSED', closed_at = ? WHERE id = ?
  `).run(now, applicationId);
  
  recordStatusHistory(applicationId, app.status, 'CLOSED', `关闭: ${reason}`, operator);

  return getApplication(applicationId);
};

export const listApplications = (filters?: { tourist_id?: string; country_id?: string; status?: string }) => {
  let sql = 'SELECT * FROM applications WHERE 1=1';
  const params: any[] = [];

  if (filters?.tourist_id) {
    sql += ' AND tourist_id = ?';
    params.push(filters.tourist_id);
  }
  if (filters?.country_id) {
    sql += ' AND country_id = ?';
    params.push(filters.country_id);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
};
