import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { Equipment, RentalOrder } from '../types';

export async function getEquipmentHistory(db: Database, serialNumber: string) {
  const equipment = await db.get(
    'SELECT * FROM equipment WHERE serial_number = ?',
    serialNumber
  );

  const rentalOrders = await db.all(
    `SELECT * FROM rental_orders 
     WHERE equipment_serial = ? 
     ORDER BY start_date DESC`,
    serialNumber
  );

  const allMaterials = await db.all(
    `SELECT m.*, b.name as batch_name
     FROM materials m
     LEFT JOIN batches b ON m.batch_id = b.id
     WHERE m.equipment_serial = ?
     ORDER BY m.created_at DESC`,
    serialNumber
  );

  const totalRepairCost = rentalOrders.reduce((sum: number, order: any) => {
    return sum + (order.repair_cost || 0);
  }, 0);

  const totalOverdueDays = allMaterials.reduce((sum: number, m: any) => {
    return sum + (m.overdue_days || 0);
  }, 0);

  return {
    equipment,
    rentalOrders,
    materials: allMaterials,
    statistics: {
      totalRentalCount: rentalOrders.length,
      totalRepairCost,
      totalOverdueDays,
      totalDeductions: allMaterials.reduce((sum: number, m: any) => 
        sum + (m.deduction_amount || 0), 0
      )
    }
  };
}

export async function upsertEquipment(
  db: Database,
  serialNumber: string,
  name?: string,
  model?: string
): Promise<Equipment> {
  const now = new Date().toISOString();
  
  const existing = await db.get(
    'SELECT * FROM equipment WHERE serial_number = ?',
    serialNumber
  );

  if (existing) {
    await db.run(
      'UPDATE equipment SET updated_at = ? WHERE serial_number = ?',
      now, serialNumber
    );
    return { ...existing, updatedAt: now } as Equipment;
  }

  await db.run(
    `INSERT INTO equipment (serial_number, name, model, current_status, total_rental_count, total_repair_cost, created_at, updated_at)
     VALUES (?, ?, ?, 'available', 0, 0, ?, ?)`,
    serialNumber, name || null, model || null, now, now
  );

  return {
    serialNumber,
    name: name || '',
    model: model || '',
    currentStatus: 'available',
    totalRentalCount: 0,
    totalRepairCost: 0,
    createdAt: now,
    updatedAt: now
  } as Equipment;
}

export async function createRentalOrder(
  db: Database,
  orderNo: string,
  equipmentSerial: string,
  customerName: string,
  startDate: string,
  endDate: string,
  depositAmount: number
): Promise<RentalOrder> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO rental_orders (id, order_no, equipment_serial, customer_name, start_date, end_date, deposit_amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    id, orderNo, equipmentSerial, customerName, startDate, endDate, depositAmount, now
  );

  await db.run(
    `UPDATE equipment 
     SET current_status = 'rented', 
         current_rental_id = ?,
         total_rental_count = total_rental_count + 1,
         updated_at = ?
     WHERE serial_number = ?`,
    id, now, equipmentSerial
  );

  return {
    id,
    orderNo,
    equipmentSerial,
    customerName,
    startDate,
    endDate,
    depositAmount,
    status: 'active',
    createdAt: now
  };
}

export async function getOrderTracking(db: Database, orderNo: string) {
  const order = await db.get(
    'SELECT * FROM rental_orders WHERE order_no = ?',
    orderNo
  );

  if (!order) {
    return null;
  }

  const materials = await db.all(
    `SELECT m.*, b.name as batch_name
     FROM materials m
     LEFT JOIN batches b ON m.batch_id = b.id
     WHERE m.order_no = ?
     ORDER BY m.created_at DESC`,
    orderNo
  );

  const deductions = await db.all(
    `SELECT * FROM deduction_records 
     WHERE order_no = ?
     ORDER BY created_at DESC`,
    orderNo
  );

  const auditLogs = await db.all(
    `SELECT * FROM audit_logs 
     WHERE entity_type = 'material' AND entity_id IN (
       SELECT id FROM materials WHERE order_no = ?
     )
     ORDER BY created_at DESC`,
    orderNo
  );

  return {
    order,
    materials,
    deductions,
    auditLogs,
    lastProcessor: materials.length > 0 ? materials[0].processed_by : null
  };
}
