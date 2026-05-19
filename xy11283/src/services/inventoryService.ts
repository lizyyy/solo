import { runQuery, getQuery, allQuery } from '../database';
import { Medicine, InventoryBatch, StockMovement } from '../models';
import { createAuditLog } from './auditService';
import { maskSensitiveData } from '../utils/security';

export async function createMedicine(
  medicine: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>,
  operatorId?: string,
  operatorName?: string
): Promise<Medicine> {
  const result = await runQuery(
    `INSERT INTO medicines (code, name, generic_name, manufacturer, specification, unit, dosage_form)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      medicine.code,
      medicine.name,
      medicine.generic_name,
      medicine.manufacturer,
      medicine.specification,
      medicine.unit,
      medicine.dosage_form
    ]
  );

  const newMedicine = await getMedicineById(result.lastID);

  await createAuditLog(
    'medicine',
    result.lastID,
    'create',
    null,
    newMedicine,
    operatorId,
    operatorName
  );

  return newMedicine;
}

export async function getMedicineById(id: number): Promise<Medicine> {
  return await getQuery('SELECT * FROM medicines WHERE id = ?', [id]);
}

export async function getMedicineByCode(code: string): Promise<Medicine> {
  return await getQuery('SELECT * FROM medicines WHERE code = ?', [code]);
}

export async function getAllMedicines(limit: number = 100, offset: number = 0): Promise<Medicine[]> {
  return await allQuery('SELECT * FROM medicines ORDER BY name LIMIT ? OFFSET ?', [limit, offset]);
}

export async function updateMedicine(
  id: number,
  updates: Partial<Medicine>,
  operatorId?: string,
  operatorName?: string
): Promise<Medicine> {
  const oldMedicine = await getMedicineById(id);

  const fields = Object.keys(updates).filter(k => k !== 'id');
  const setClause = fields.map(k => `${k} = ?`).join(', ');
  const values = fields.map(k => (updates as any)[k]);

  await runQuery(
    `UPDATE medicines SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, id]
  );

  const updatedMedicine = await getMedicineById(id);

  await createAuditLog(
    'medicine',
    id,
    'update',
    oldMedicine,
    updatedMedicine,
    operatorId,
    operatorName
  );

  return updatedMedicine;
}

export async function createInventoryBatch(
  batch: Omit<InventoryBatch, 'id' | 'created_at'>,
  operatorId?: string,
  operatorName?: string
): Promise<InventoryBatch> {
  const result = await runQuery(
    `INSERT INTO inventory_batches (medicine_id, batch_number, quantity, unit, manufacture_date, expiry_date, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.medicine_id,
      batch.batch_number,
      batch.quantity,
      batch.unit,
      batch.manufacture_date,
      batch.expiry_date,
      batch.location,
      batch.status || 'active'
    ]
  );

  const newBatch = await getInventoryBatchById(result.lastID);

  await createStockMovement(
    {
      batch_id: result.lastID,
      movement_type: 'in',
      quantity: batch.quantity,
      unit: batch.unit,
      reference_no: batch.batch_number,
      notes: '初始入库',
      operator_id: operatorId
    }
  );

  await createAuditLog(
    'inventory_batch',
    result.lastID,
    'create',
    null,
    newBatch,
    operatorId,
    operatorName
  );

  return newBatch;
}

export async function getInventoryBatchById(id: number): Promise<InventoryBatch> {
  return await getQuery('SELECT * FROM inventory_batches WHERE id = ?', [id]);
}

export async function getInventoryBatchesByMedicineId(medicineId: number): Promise<InventoryBatch[]> {
  return await allQuery(
    `SELECT * FROM inventory_batches 
     WHERE medicine_id = ? AND status = 'active' AND quantity > 0
     ORDER BY expiry_date ASC`,
    [medicineId]
  );
}

export async function getAllInventoryBatches(includeInactive: boolean = false): Promise<InventoryBatch[]> {
  let sql = 'SELECT * FROM inventory_batches';
  if (!includeInactive) {
    sql += " WHERE status = 'active'";
  }
  sql += ' ORDER BY created_at DESC';
  return await allQuery(sql);
}

export async function updateInventoryBatchQuantity(
  id: number,
  quantityChange: number,
  operatorId?: string
): Promise<InventoryBatch> {
  const oldBatch = await getInventoryBatchById(id);

  await runQuery(
    `UPDATE inventory_batches SET quantity = quantity + ? WHERE id = ?`,
    [quantityChange, id]
  );

  const updatedBatch = await getInventoryBatchById(id);

  await createAuditLog(
    'inventory_batch',
    id,
    'quantity_update',
    oldBatch,
    updatedBatch,
    operatorId,
    undefined
  );

  return updatedBatch;
}

export async function createStockMovement(
  movement: Omit<StockMovement, 'id' | 'created_at'>
): Promise<StockMovement> {
  const result = await runQuery(
    `INSERT INTO stock_movements (batch_id, prescription_item_id, movement_type, quantity, unit, reference_no, notes, operator_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movement.batch_id,
      movement.prescription_item_id,
      movement.movement_type,
      movement.quantity,
      movement.unit,
      movement.reference_no,
      movement.notes,
      movement.operator_id
    ]
  );

  return await getStockMovementById(result.lastID);
}

export async function getStockMovementById(id: number): Promise<StockMovement> {
  return await getQuery('SELECT * FROM stock_movements WHERE id = ?', [id]);
}

export async function getStockMovementsByBatchId(batchId: number): Promise<StockMovement[]> {
  return await allQuery(
    'SELECT * FROM stock_movements WHERE batch_id = ? ORDER BY created_at DESC',
    [batchId]
  );
}

export async function getInventorySummary(): Promise<any[]> {
  return await allQuery(`
    SELECT 
      m.id as medicine_id,
      m.code,
      m.name,
      m.unit,
      SUM(ib.quantity) as total_quantity,
      COUNT(DISTINCT ib.id) as batch_count,
      MIN(ib.expiry_date) as earliest_expiry
    FROM medicines m
    LEFT JOIN inventory_batches ib ON m.id = ib.medicine_id AND ib.status = 'active'
    GROUP BY m.id, m.code, m.name, m.unit
    ORDER BY m.name
  `);
}
