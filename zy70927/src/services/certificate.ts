import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { getDatabase } from '../database';
import { TrainingMaterial, CertificateInfo } from '../types';

export function generateCertificateId(): string {
  return `CERT-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
}

export function generateQRCodeContent(certificateId: string, trainingId: string, employeeId: string): string {
  const payload = JSON.stringify({ certificateId, trainingId, employeeId, timestamp: Date.now() });
  return CryptoJS.MD5(payload).toString();
}

export async function createCertificates(
  batchId: string,
  material: TrainingMaterial,
  materialIndex: number
): Promise<CertificateInfo[]> {
  const db = getDatabase();
  const certificates: CertificateInfo[] = [];
  const issueDate = new Date().toISOString().split('T')[0];

  for (let i = 0; i < material.attendance.length; i++) {
    const attendance = material.attendance[i];
    const certificateId = generateCertificateId();
    const qrCode = generateQRCodeContent(certificateId, material.trainingId, attendance.employeeId);

    await db.run(
      `INSERT INTO certificates (certificate_id, batch_id, training_id, training_name, employee_id, employee_name, department, issue_date, qr_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      certificateId,
      batchId,
      material.trainingId,
      material.trainingName,
      attendance.employeeId,
      attendance.employeeName,
      attendance.department,
      issueDate,
      qrCode,
      new Date().toISOString()
    );

    certificates.push({
      certificateId,
      trainingId: material.trainingId,
      trainingName: material.trainingName,
      employeeId: attendance.employeeId,
      employeeName: attendance.employeeName,
      department: attendance.department,
      issueDate,
      qrCode,
    });
  }

  return certificates;
}

export async function getCertificatesByBatchId(batchId: string): Promise<CertificateInfo[]> {
  const db = getDatabase();
  const rows = await db.all('SELECT * FROM certificates WHERE batch_id = ?', batchId);
  return rows.map(row => ({
    certificateId: row.certificate_id,
    trainingId: row.training_id,
    trainingName: row.training_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    issueDate: row.issue_date,
    qrCode: row.qr_code,
  }));
}

export async function getCertificateById(certificateId: string): Promise<CertificateInfo | null> {
  const db = getDatabase();
  const row = await db.get('SELECT * FROM certificates WHERE certificate_id = ?', certificateId);
  if (!row) return null;
  return {
    certificateId: row.certificate_id,
    trainingId: row.training_id,
    trainingName: row.training_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    issueDate: row.issue_date,
    qrCode: row.qr_code,
  };
}
