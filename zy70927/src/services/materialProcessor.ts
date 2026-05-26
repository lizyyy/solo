import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import {
  TrainingMaterial,
  ValidationError,
  BatchSubmitResponse,
  CertificateInfo,
} from '../types';
import { validateTrainingMaterial } from './validation';
import { createCertificates } from './certificate';
import { addTraceLog } from './trace';

export async function processMaterials(
  batchId: string,
  materials: TrainingMaterial[],
  submittedBy: string,
  materialHash: string
): Promise<BatchSubmitResponse> {
  const db = getDatabase();
  const createdAt = new Date().toISOString();

  const allErrors: ValidationError[] = [];
  const allCertificates: CertificateInfo[] = [];
  const existingTrainingIds = new Set<string>();
  const validMaterialIndices = new Set<number>();

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    const errors = validateTrainingMaterial(material, i, existingTrainingIds);

    if (errors.length > 0) {
      allErrors.push(...errors);
      for (const err of errors) {
        await db.run(
          `INSERT INTO validation_errors (batch_id, material_index, attendance_index, field, value, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          batchId,
          err.materialIndex,
          err.attendanceIndex || null,
          err.field,
          err.value !== undefined && err.value !== null ? String(err.value) : null,
          err.error,
          createdAt
        );
      }
    } else {
      validMaterialIndices.add(i);
    }

    await db.run(
      `INSERT INTO raw_materials (batch_id, material_index, training_id, training_name, trainer, training_date, start_time, end_time, location, raw_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      batchId,
      i,
      material.trainingId,
      material.trainingName,
      material.trainer,
      material.trainingDate,
      material.startTime,
      material.endTime,
      material.location,
      JSON.stringify(material),
      createdAt
    );

    await addTraceLog(
      batchId,
      'trainingId',
      'raw_input',
      material.trainingId,
      submittedBy,
      '原始材料提交',
      material.trainingId
    );
    await addTraceLog(
      batchId,
      'trainingName',
      'raw_input',
      material.trainingName,
      submittedBy,
      '原始材料提交',
      material.trainingId
    );

    if (errors.length === 0) {
      for (let j = 0; j < material.attendance.length; j++) {
        const attendance = material.attendance[j];
        await db.run(
          `INSERT INTO attendance_records (batch_id, material_index, attendance_index, employee_id, employee_name, department, sign_in_time, sign_out_time, is_valid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          batchId,
          i,
          j,
          attendance.employeeId,
          attendance.employeeName,
          attendance.department,
          attendance.signInTime,
          attendance.signOutTime,
          createdAt
        );

        await addTraceLog(
          batchId,
          'employeeId',
          'raw_input',
          attendance.employeeId,
          submittedBy,
          '原始签到记录',
          material.trainingId,
          attendance.employeeId
        );
      }
    }
  }

  const status: BatchSubmitResponse['status'] =
    allErrors.length === 0
      ? 'success'
      : validMaterialIndices.size > 0
      ? 'partial'
      : 'failed';

  for (const idx of validMaterialIndices) {
    const material = materials[idx];
    const certificates = await createCertificates(batchId, material, idx);
    allCertificates.push(...certificates);

    for (const cert of certificates) {
      await addTraceLog(
        batchId,
        'certificateId',
        'certificate',
        cert.certificateId,
        submittedBy,
        '证书生成',
        material.trainingId,
        cert.employeeId
      );
    }
  }

  await db.run(
    `INSERT INTO batches (batch_id, material_hash, submitted_by, status, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    batchId,
    materialHash,
    submittedBy,
    status,
    createdAt
  );

  return {
    batchId,
    isDuplicate: false,
    status,
    totalMaterials: materials.length,
    validMaterials: validMaterialIndices.size,
    invalidMaterials: materials.length - validMaterialIndices.size,
    errors: allErrors,
    certificates: allCertificates,
    createdAt,
  };
}

export async function getBatchResponse(batchId: string): Promise<BatchSubmitResponse | null> {
  const db = getDatabase();

  const batchRow = await db.get('SELECT * FROM batches WHERE batch_id = ?', batchId);
  if (!batchRow) return null;

  const errorRows = await db.all(
    'SELECT * FROM validation_errors WHERE batch_id = ?',
    batchId
  );
  const errors: ValidationError[] = errorRows.map(row => ({
    materialIndex: row.material_index,
    attendanceIndex: row.attendance_index ?? undefined,
    field: row.field,
    value: row.value,
    error: row.error,
  }));

  const certRows = await db.all(
    'SELECT * FROM certificates WHERE batch_id = ?',
    batchId
  );
  const certificates: CertificateInfo[] = certRows.map(row => ({
    certificateId: row.certificate_id,
    trainingId: row.training_id,
    trainingName: row.training_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    issueDate: row.issue_date,
    qrCode: row.qr_code,
  }));

  const materialCountRow = await db.get(
    'SELECT COUNT(*) as count FROM raw_materials WHERE batch_id = ?',
    batchId
  );

  return {
    batchId: batchRow.batch_id,
    isDuplicate: true,
    status: batchRow.status as BatchSubmitResponse['status'],
    totalMaterials: materialCountRow?.count || 0,
    validMaterials: certificates.length > 0 ? new Set(certificates.map(c => c.trainingId)).size : 0,
    invalidMaterials: (materialCountRow?.count || 0) - (certificates.length > 0 ? new Set(certificates.map(c => c.trainingId)).size : 0),
    errors,
    certificates,
    createdAt: batchRow.created_at,
  };
}
