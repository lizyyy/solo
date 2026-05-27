import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { MaterialStatus, RegisterMaterialRequest, ReclassifyRequest } from '../types';
import { classifyMaterial, checkDuplicateDeduction, ClassificationResult } from './classificationService';
import { upsertEquipment, getEquipmentHistory } from './equipmentService';
import { createProcessingRecord, logAudit } from './auditService';

export async function createBatch(db: Database, name: string, createdBy: string) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO batches (id, name, created_by, created_at, status, total_count, normal_count, pending_count, blocked_count)
     VALUES (?, ?, ?, ?, 'processing', 0, 0, 0, 0)`,
    id, name, createdBy, now
  );

  await logAudit(db, 'batch', id, 'create', createdBy, '创建批次');

  return { id, name, createdBy, createdAt: now };
}

export async function registerMaterial(
  db: Database,
  request: RegisterMaterialRequest,
  operator: string
) {
  const batch = await db.get('SELECT * FROM batches WHERE id = ?', request.batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  await upsertEquipment(
    db,
    request.equipmentSerial,
    request.equipmentName,
    request.equipmentModel
  );

  const duplicateCheck = await checkDuplicateDeduction(
    db,
    request.orderNo,
    request.equipmentSerial
  );

  const equipmentHistory = await getEquipmentHistory(db, request.equipmentSerial);
  const classification = classifyMaterial(request, duplicateCheck.isDuplicate, equipmentHistory);

  const materialId = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO materials (
      id, batch_id, order_no, equipment_serial, customer_name, rental_start_date, rental_end_date,
      deposit_amount, actual_return_date, repair_cost, overdue_days, overdue_fee, deduction_amount,
      status, status_reason, next_action, processed_by, processed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    materialId,
    request.batchId,
    request.orderNo,
    request.equipmentSerial,
    request.customerName,
    request.rentalStartDate,
    request.rentalEndDate,
    request.depositAmount,
    request.actualReturnDate || null,
    request.repairCost || null,
    classification.overdueDays || 0,
    classification.overdueFee || 0,
    classification.deductionAmount || 0,
    classification.status,
    classification.reason,
    classification.nextAction,
    operator,
    now,
    now,
    now
  );

  if (classification.status !== 'blocked' && classification.deductionAmount && classification.deductionAmount > 0) {
    await createDeductionRecord(
      db,
      materialId,
      request.orderNo,
      request.equipmentSerial,
      classification.deductionType || 'other',
      classification.deductionAmount,
      classification.reason,
      operator,
      duplicateCheck.isDuplicate,
      duplicateCheck.existingRecord?.id
    );
  }

  await updateBatchCounts(db, request.batchId);

  await logAudit(db, 'material', materialId, 'create', operator, '登记材料');

  return {
    id: materialId,
    status: classification.status,
    statusReason: classification.reason,
    nextAction: classification.nextAction,
    deductionAmount: classification.deductionAmount,
    isDuplicate: duplicateCheck.isDuplicate
  };
}

export async function createDeductionRecord(
  db: Database,
  materialId: string,
  orderNo: string,
  equipmentSerial: string,
  deductionType: string,
  amount: number,
  reason: string,
  processedBy: string,
  isDuplicate: boolean = false,
  duplicateOf?: string
) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO deduction_records (
      id, material_id, order_no, equipment_serial, deduction_type, amount, reason,
      processed_by, is_duplicate, duplicate_of, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, materialId, orderNo, equipmentSerial, deductionType, amount, reason,
    processedBy, isDuplicate ? 1 : 0, duplicateOf || null, now
  );

  await logAudit(db, 'deduction', id, 'create', processedBy, reason);

  return id;
}

export async function reclassifyMaterial(db: Database, request: ReclassifyRequest) {
  const material = await db.get('SELECT * FROM materials WHERE id = ?', request.materialId);
  if (!material) {
    throw new Error('材料不存在');
  }

  await createProcessingRecord(
    db,
    request.materialId,
    material.status,
    request.newStatus,
    material.status_reason,
    request.newReason,
    request.operator,
    request.changeReason,
    material.deduction_amount,
    request.newDeduction
  );

  const now = new Date().toISOString();
  await db.run(
    `UPDATE materials 
     SET status = ?, status_reason = ?, deduction_amount = ?, processed_by = ?, processed_at = ?, updated_at = ?
     WHERE id = ?`,
    request.newStatus,
    request.newReason,
    request.newDeduction || null,
    request.operator,
    now,
    now,
    request.materialId
  );

  if (request.newStatus !== 'blocked' && request.newDeduction && request.newDeduction > 0) {
    const existingDeduction = await db.get(
      'SELECT * FROM deduction_records WHERE material_id = ?',
      request.materialId
    );

    if (!existingDeduction) {
      await createDeductionRecord(
        db,
        request.materialId,
        material.order_no,
        material.equipment_serial,
        'other',
        request.newDeduction,
        request.newReason,
        request.operator
      );
    }
  }

  await updateBatchCounts(db, material.batch_id);

  return { success: true };
}

export async function recalculateMaterial(db: Database, materialId: string, operator: string) {
  const material = await db.get('SELECT * FROM materials WHERE id = ?', materialId);
  if (!material) {
    throw new Error('材料不存在');
  }

  const duplicateCheck = await checkDuplicateDeduction(
    db,
    material.order_no,
    material.equipment_serial,
    materialId
  );

  const request: RegisterMaterialRequest = {
    batchId: material.batch_id,
    orderNo: material.order_no,
    equipmentSerial: material.equipment_serial,
    customerName: material.customer_name,
    rentalStartDate: material.rental_start_date,
    rentalEndDate: material.rental_end_date,
    depositAmount: material.deposit_amount,
    actualReturnDate: material.actual_return_date,
    repairCost: material.repair_cost
  };

  const equipmentHistory = await getEquipmentHistory(db, material.equipment_serial);
  const classification = classifyMaterial(request, duplicateCheck.isDuplicate, equipmentHistory);

  if (classification.status !== material.status || 
      classification.reason !== material.status_reason ||
      classification.deductionAmount !== material.deduction_amount) {
    
    await createProcessingRecord(
      db,
      materialId,
      material.status,
      classification.status,
      material.status_reason,
      classification.reason,
      operator,
      '系统重算',
      material.deduction_amount,
      classification.deductionAmount
    );

    const now = new Date().toISOString();
    await db.run(
      `UPDATE materials 
       SET status = ?, status_reason = ?, next_action = ?, 
           overdue_days = ?, overdue_fee = ?, deduction_amount = ?,
           processed_by = ?, processed_at = ?, updated_at = ?
       WHERE id = ?`,
      classification.status,
      classification.reason,
      classification.nextAction,
      classification.overdueDays || 0,
      classification.overdueFee || 0,
      classification.deductionAmount || 0,
      operator,
      now,
      now,
      materialId
    );

    await updateBatchCounts(db, material.batch_id);
  }

  return {
    id: materialId,
    previousStatus: material.status,
    newStatus: classification.status,
    previousReason: material.status_reason,
    newReason: classification.reason
  };
}

export async function recalculateBatch(db: Database, batchId: string, operator: string) {
  const materials = await db.all(
    'SELECT id FROM materials WHERE batch_id = ?',
    batchId
  );

  const results = [];
  for (const m of materials) {
    const result = await recalculateMaterial(db, m.id, operator);
    results.push(result);
  }

  return {
    total: materials.length,
    changed: results.filter(r => r.previousStatus !== r.newStatus).length,
    results
  };
}

export async function updateBatchCounts(db: Database, batchId: string) {
  const counts = await db.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
     FROM materials WHERE batch_id = ?`,
    batchId
  );

  await db.run(
    `UPDATE batches 
     SET total_count = ?, normal_count = ?, pending_count = ?, blocked_count = ?
     WHERE id = ?`,
    counts?.total || 0,
    counts?.normal || 0,
    counts?.pending || 0,
    counts?.blocked || 0,
    batchId
  );
}

export async function getMaterialsByBatch(db: Database, batchId: string, status?: MaterialStatus) {
  let query = 'SELECT * FROM materials WHERE batch_id = ?';
  const params: any[] = [batchId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  return db.all(query, ...params);
}

export async function getMaterialDetail(db: Database, materialId: string) {
  return db.get('SELECT * FROM materials WHERE id = ?', materialId);
}

export async function getBatches(db: Database) {
  return db.all('SELECT * FROM batches ORDER BY created_at DESC');
}

export async function getBatchDetail(db: Database, batchId: string) {
  const batch = await db.get('SELECT * FROM batches WHERE id = ?', batchId);
  if (!batch) return null;

  const materials = await db.all(
    'SELECT * FROM materials WHERE batch_id = ? ORDER BY created_at DESC',
    batchId
  );

  return { batch, materials };
}
