import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getApplication } from './application.service';

export const uploadMaterial = (
  applicationId: string,
  typeId: string,
  fileUrl: string,
  expireAt?: number,
  remark?: string
) => {
  const app = getApplication(applicationId);
  if (!app) throw new Error('申请不存在');
  if (!['DRAFT', 'SUPPLEMENT', 'RETURNED'].includes(app.status)) {
    throw new Error('当前状态不允许上传材料');
  }

  const materialType = db.prepare('SELECT * FROM material_types WHERE id = ?').get(typeId);
  if (!materialType) throw new Error('材料类型不存在');

  const latest = db.prepare(`
    SELECT MAX(version) as max_version FROM materials 
    WHERE application_id = ? AND type_id = ?
  `).get(applicationId, typeId) as { max_version: number };
  
  const newVersion = (latest.max_version || 0) + 1;

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO materials (id, application_id, type_id, version, status, file_url, expire_at, remark)
    VALUES (?, ?, ?, ?, 'UPLOADED', ?, ?, ?)
  `);
  stmt.run(id, applicationId, typeId, newVersion, fileUrl, expireAt || null, remark || null);

  const pendingRequests = db.prepare(`
    SELECT id FROM supplement_requests 
    WHERE material_id IN (
      SELECT id FROM materials WHERE application_id = ? AND type_id = ?
    ) AND status = 'PENDING'
  `).all(applicationId, typeId) as { id: string }[];

  for (const req of pendingRequests) {
    db.prepare(`
      UPDATE supplement_requests 
      SET status = 'RESOLVED', resolved_at = ? 
      WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), req.id);
  }

  return getMaterial(id);
};

export const getMaterial = (id: string) => {
  return db.prepare(`
    SELECT m.*, mt.name as type_name, mt.required, mt.validity_days
    FROM materials m
    JOIN material_types mt ON m.type_id = mt.id
    WHERE m.id = ?
  `).get(id);
};

export const reviewMaterial = (
  materialId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerNote?: string
) => {
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
  if (!material) throw new Error('材料不存在');
  
  const app = getApplication(material.application_id);
  if (!app || app.status !== 'REVIEWING') {
    throw new Error('只有审核中的申请可以审核材料');
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE materials 
    SET status = ?, reviewed_at = ?, reviewer_note = ?
    WHERE id = ?
  `).run(status, now, reviewerNote || null, materialId);

  return getMaterial(materialId);
};

export const getMaterialVersions = (applicationId: string, typeId: string) => {
  return db.prepare(`
    SELECT m.*, mt.name as type_name
    FROM materials m
    JOIN material_types mt ON m.type_id = mt.id
    WHERE m.application_id = ? AND m.type_id = ?
    ORDER BY m.version DESC
  `).all(applicationId, typeId);
};

export const getSupplementRequests = (applicationId?: string) => {
  let sql = `
    SELECT sr.*, m.type_id, mt.name as type_name, t.name as tourist_name
    FROM supplement_requests sr
    JOIN materials m ON sr.material_id = m.id
    JOIN material_types mt ON m.type_id = mt.id
    JOIN applications a ON sr.application_id = a.id
    JOIN tourists t ON a.tourist_id = t.id
  `;
  const params: any[] = [];

  if (applicationId) {
    sql += ' WHERE sr.application_id = ?';
    params.push(applicationId);
  }

  sql += ' ORDER BY sr.requested_at DESC';
  return db.prepare(sql).all(...params);
};
