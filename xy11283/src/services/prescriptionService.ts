import { runQuery, getQuery, allQuery } from '../database';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../models';
import { createAuditLog } from './auditService';
import { 
  getDosageRulesByMedicineAndSpecies, 
  calculateDosage, 
  validatePrescriptionDosage 
} from './dosageService';
import { 
  getInventoryBatchesByMedicineId, 
  updateInventoryBatchQuantity,
  createStockMovement 
} from './inventoryService';
import { maskSensitiveData } from '../utils/security';

export async function createPrescription(
  prescription: Omit<Prescription, 'id' | 'created_at' | 'status' | 'total_amount'>,
  items: Omit<PrescriptionItem, 'id' | 'prescription_id' | 'calculated_dosage' | 'dosage_warning' | 'status'>[],
  operatorId?: string,
  operatorName?: string
): Promise<{ prescription: Prescription; items: PrescriptionItem[]; errors: string[] }> {
  const errors: string[] = [];
  const validatedItems: PrescriptionItem[] = [];

  for (const item of items) {
    const rules = await getDosageRulesByMedicineAndSpecies(item.medicine_id, prescription.species);
    const calcResult = calculateDosage(prescription.weight, prescription.weight_unit || 'kg', rules);

    if (!calcResult.valid) {
      errors.push(`药品 ID ${item.medicine_id}: ${calcResult.error}`);
      continue;
    }

    const validation = validatePrescriptionDosage(item.dosage, calcResult);
    if (!validation.valid) {
      errors.push(`药品 ID ${item.medicine_id}: ${validation.warning}`);
    }

    validatedItems.push({
      ...item,
      prescription_id: 0,
      calculated_dosage: calcResult.calculatedDosage,
      dosage_warning: validation.warning || calcResult.warning,
      status: 'pending'
    });

    const batches = await getInventoryBatchesByMedicineId(item.medicine_id);
    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalStock < item.quantity) {
      errors.push(`药品 ID ${item.medicine_id}: 库存不足，需要 ${item.quantity}${item.quantity_unit}，当前只有 ${totalStock}${item.quantity_unit}`);
    }
  }

  const result = await runQuery(
    `INSERT INTO prescriptions (prescription_no, patient_id, patient_name, species, breed, weight, weight_unit, age, doctor_id, doctor_name, diagnosis, status, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prescription.prescription_no,
      prescription.patient_id,
      prescription.patient_name,
      prescription.species,
      prescription.breed,
      prescription.weight,
      prescription.weight_unit || 'kg',
      prescription.age,
      prescription.doctor_id,
      prescription.doctor_name,
      prescription.diagnosis,
      errors.length > 0 ? 'pending' : 'validated',
      prescription.issued_at || new Date().toISOString()
    ]
  );

  const prescriptionId = result.lastID;

  for (const item of validatedItems) {
    item.prescription_id = prescriptionId;
    await runQuery(
      `INSERT INTO prescription_items (prescription_id, medicine_id, batch_id, dosage, dosage_unit, quantity, quantity_unit, frequency, route, days, notes, calculated_dosage, dosage_warning, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.prescription_id,
        item.medicine_id,
        item.batch_id,
        item.dosage,
        item.dosage_unit,
        item.quantity,
        item.quantity_unit,
        item.frequency,
        item.route,
        item.days,
        item.notes,
        item.calculated_dosage,
        item.dosage_warning,
        item.status
      ]
    );
  }

  const newPrescription = await getPrescriptionById(prescriptionId);
  const prescriptionItems = await getPrescriptionItems(prescriptionId);

  await createAuditLog(
    'prescription',
    prescriptionId,
    'create',
    null,
    newPrescription,
    operatorId,
    operatorName
  );

  return {
    prescription: newPrescription,
    items: prescriptionItems,
    errors
  };
}

export async function getPrescriptionById(id: number): Promise<Prescription> {
  const prescription = await getQuery('SELECT * FROM prescriptions WHERE id = ?', [id]);
  return maskSensitiveData(prescription);
}

export async function getPrescriptionByNo(prescriptionNo: string): Promise<Prescription> {
  const prescription = await getQuery('SELECT * FROM prescriptions WHERE prescription_no = ?', [prescriptionNo]);
  return maskSensitiveData(prescription);
}

export async function getPrescriptionItems(prescriptionId: number): Promise<PrescriptionItem[]> {
  return await allQuery('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
}

export async function getAllPrescriptions(
  status?: PrescriptionStatus,
  limit: number = 100,
  offset: number = 0
): Promise<Prescription[]> {
  let sql = 'SELECT * FROM prescriptions WHERE 1=1';
  const params: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const prescriptions = await allQuery(sql, params);
  return prescriptions.map(p => maskSensitiveData(p));
}

export async function validatePrescription(
  id: number,
  operatorId?: string,
  operatorName?: string
): Promise<{ success: boolean; errors: string[] }> {
  const prescription = await getPrescriptionById(id);
  const items = await getPrescriptionItems(id);
  const errors: string[] = [];

  for (const item of items) {
    const batches = await getInventoryBatchesByMedicineId(item.medicine_id);
    const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
    
    if (totalStock < item.quantity) {
      errors.push(`药品 ID ${item.medicine_id}: 库存不足`);
    }

    if (batches.length > 0 && !item.batch_id) {
      const earliestBatch = batches[0];
      await runQuery(
        'UPDATE prescription_items SET batch_id = ? WHERE id = ?',
        [earliestBatch.id, item.id]
      );
    }
  }

  const oldPrescription = { ...prescription };
  const newStatus = errors.length > 0 ? 'pending' : 'validated';
  
  await runQuery('UPDATE prescriptions SET status = ? WHERE id = ?', [newStatus, id]);
  
  const updatedPrescription = await getPrescriptionById(id);

  await createAuditLog(
    'prescription',
    id,
    'validate',
    oldPrescription,
    updatedPrescription,
    operatorId,
    operatorName
  );

  return { success: errors.length === 0, errors };
}

export async function dispensePrescription(
  id: number,
  operatorId?: string,
  operatorName?: string
): Promise<{ success: boolean; errors: string[] }> {
  const prescription = await getPrescriptionById(id);
  
  if (prescription.status !== 'validated') {
    return { success: false, errors: ['处方未通过审核，无法发药'] };
  }

  const items = await getPrescriptionItems(id);
  const errors: string[] = [];

  for (const item of items) {
    if (!item.batch_id) {
      errors.push(`药品 ID ${item.medicine_id}: 未选择批次`);
      continue;
    }

    const batches = await getInventoryBatchesByMedicineId(item.medicine_id);
    const batch = batches.find(b => b.id === item.batch_id);

    if (!batch || batch.quantity < item.quantity) {
      errors.push(`药品 ID ${item.medicine_id}: 批次 ${item.batch_id} 库存不足`);
      continue;
    }

    await updateInventoryBatchQuantity(item.batch_id, -item.quantity, operatorId);
    await createStockMovement({
      batch_id: item.batch_id,
      prescription_item_id: item.id,
      movement_type: 'out',
      quantity: -item.quantity,
      unit: item.quantity_unit,
      reference_no: prescription.prescription_no,
      notes: '处方发药',
      operator_id: operatorId
    });

    await runQuery(
      'UPDATE prescription_items SET status = ? WHERE id = ?',
      ['dispensed', item.id]
    );
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const oldPrescription = { ...prescription };
  
  await runQuery('UPDATE prescriptions SET status = ? WHERE id = ?', ['dispensed', id]);
  
  const updatedPrescription = await getPrescriptionById(id);

  await createAuditLog(
    'prescription',
    id,
    'dispense',
    oldPrescription,
    updatedPrescription,
    operatorId,
    operatorName
  );

  return { success: true, errors: [] };
}

export async function cancelPrescription(
  id: number,
  operatorId?: string,
  operatorName?: string
): Promise<Prescription> {
  const oldPrescription = await getPrescriptionById(id);

  await runQuery('UPDATE prescriptions SET status = ? WHERE id = ?', ['cancelled', id]);

  const updatedPrescription = await getPrescriptionById(id);

  await createAuditLog(
    'prescription',
    id,
    'cancel',
    oldPrescription,
    updatedPrescription,
    operatorId,
    operatorName
  );

  return updatedPrescription;
}

export async function getPrescriptionStats(days: number = 30): Promise<any> {
  return await allQuery(`
    SELECT 
      status,
      DATE(created_at) as date,
      COUNT(*) as count
    FROM prescriptions
    WHERE created_at >= datetime('now', '-? days')
    GROUP BY status, DATE(created_at)
    ORDER BY date DESC
  `, [days]);
}
