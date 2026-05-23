import { db, generateId, getCurrentTime, generateOrderNo } from './database';
import { Equipment, RentalOrder, ReturnInspection, DepositDeduction, RentalReport, ExceptionLog } from './types';

const STATUS_FLOW: Record<RentalOrder['status'], RentalOrder['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['returned'],
  returned: ['completed'],
  completed: [],
  cancelled: [],
};

export function validateStatusTransition(
  currentStatus: RentalOrder['status'],
  newStatus: RentalOrder['status']
): boolean {
  const allowedNext = STATUS_FLOW[currentStatus] || [];
  return allowedNext.includes(newStatus);
}

export async function logException(
  operationType: string,
  originalInput: any,
  errorMessage?: string
): Promise<string> {
  const id = generateId();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO exception_logs (id, operation_type, original_input, error_message, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, operationType, JSON.stringify(originalInput), errorMessage, getCurrentTime(), 'pending'],
      (err) => {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
}

export async function updateExceptionLog(
  id: string,
  processingConclusion: string,
  handledBy: string
): Promise<void> {
  const now = getCurrentTime();
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE exception_logs 
       SET processing_conclusion = ?, handled_by = ?, handled_at = ?, status = 'handled'
       WHERE id = ?`,
      [processingConclusion, handledBy, now, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export async function getExceptionLog(id: string): Promise<ExceptionLog | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM exception_logs WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err);
      else resolve(row as ExceptionLog | undefined);
    });
  });
}

export function calculateOverdueDays(expectedEnd: string, actualEnd: string): number {
  const expected = new Date(expectedEnd);
  const actual = new Date(actualEnd);
  const diffTime = actual.getTime() - expected.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function calculateRentalFee(
  dailyRate: number,
  startDate: string,
  endDate: string
): { days: number; fee: number } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return { days: Math.max(1, days), fee: Math.max(1, days) * dailyRate };
}

export async function checkAccessoriesComplete(rentalOrderId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT expected_quantity, returned_quantity FROM rental_accessories WHERE rental_order_id = ?`,
      [rentalOrderId],
      (err, rows: any[]) => {
        if (err) reject(err);
        const allComplete = rows.every(
          (row) => row.returned_quantity >= row.expected_quantity
        );
        resolve(allComplete);
      }
    );
  });
}

export async function createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
  const id = generateId();
  const now = getCurrentTime();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO equipment (id, name, category, model, serial_number, status, deposit_amount, daily_rate, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.category, data.model, data.serial_number, data.status, data.deposit_amount, data.daily_rate, data.description, now, now],
      function (err) {
        if (err) reject(err);
        else resolve({ ...data, id, created_at: now, updated_at: now } as Equipment);
      }
    );
  });
}

export async function getEquipment(id: string): Promise<Equipment | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM equipment WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err);
      else resolve(row as Equipment | undefined);
    });
  });
}

export async function getAllEquipment(): Promise<Equipment[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM equipment ORDER BY created_at DESC`, [], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as Equipment[]);
    });
  });
}

export async function createRentalOrder(data: {
  equipment_id: string;
  borrower_name: string;
  borrower_phone?: string;
  borrower_id?: string;
  expected_start_date: string;
  expected_end_date: string;
  deposit_paid: number;
  notes?: string;
  accessory_ids: string[];
}): Promise<RentalOrder> {
  const id = generateId();
  const orderNo = generateOrderNo();
  const now = getCurrentTime();

  const equipment = await getEquipment(data.equipment_id);
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  if (equipment.status !== 'available') {
    throw new Error('Equipment is not available');
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `INSERT INTO rental_orders (id, order_no, equipment_id, borrower_name, borrower_phone, borrower_id, expected_start_date, expected_end_date, deposit_paid, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, orderNo, data.equipment_id, data.borrower_name, data.borrower_phone, data.borrower_id, data.expected_start_date, data.expected_end_date, data.deposit_paid, 'pending', data.notes, now, now],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
        }
      );

      data.accessory_ids.forEach((accessoryId) => {
        const rentalAccessoryId = generateId();
        db.run(
          `INSERT INTO rental_accessories (id, rental_order_id, accessory_id, expected_quantity, status)
           SELECT ?, ?, id, quantity, 'pending' FROM accessories WHERE id = ?`,
          [rentalAccessoryId, id, accessoryId]
        );
      });

      db.run(
        `UPDATE equipment SET status = 'rented', updated_at = ? WHERE id = ?`,
        [now, data.equipment_id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            db.run('COMMIT');
            resolve({
              id,
              order_no: orderNo,
              equipment_id: data.equipment_id,
              borrower_name: data.borrower_name,
              borrower_phone: data.borrower_phone,
              borrower_id: data.borrower_id,
              expected_start_date: data.expected_start_date,
              expected_end_date: data.expected_end_date,
              deposit_paid: data.deposit_paid,
              status: 'pending',
              notes: data.notes,
              created_at: now,
              updated_at: now,
            } as RentalOrder);
          }
        }
      );
    });
  });
}

export async function getRentalOrder(id: string): Promise<RentalOrder | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM rental_orders WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err);
      else resolve(row as RentalOrder | undefined);
    });
  });
}

export async function getAllRentalOrders(): Promise<RentalOrder[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM rental_orders ORDER BY created_at DESC`, [], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as RentalOrder[]);
    });
  });
}

export async function updateRentalOrderStatus(id: string, status: RentalOrder['status'], actualDate?: string): Promise<RentalOrder> {
  const now = getCurrentTime();
  const order = await getRentalOrder(id);
  if (!order) throw new Error('Rental order not found');

  if (order.status !== status && !validateStatusTransition(order.status, status)) {
    throw new Error(`Invalid status transition from ${order.status} to ${status}`);
  }

  let updateField = '';
  let updateValue: string | undefined = actualDate;

  if (status === 'active' && !order.actual_start_date) {
    updateField = 'actual_start_date';
    updateValue = actualDate || now;
  } else if (status === 'returned' && !order.actual_end_date) {
    updateField = 'actual_end_date';
    updateValue = actualDate || now;
  }

  return new Promise((resolve, reject) => {
    if (updateField) {
      db.run(
        `UPDATE rental_orders SET status = ?, updated_at = ?, ${updateField} = ? WHERE id = ?`,
        [status, now, updateValue, id],
        async (err) => {
          if (err) reject(err);
          else {
            if (status === 'returned' || status === 'completed') {
              const equipment = await getEquipment(order.equipment_id);
              if (equipment) {
                db.run(`UPDATE equipment SET status = 'available', updated_at = ? WHERE id = ?`, [now, order.equipment_id]);
              }
            }
            const updated = await getRentalOrder(id);
            resolve(updated!);
          }
        }
      );
    } else {
      db.run(
        `UPDATE rental_orders SET status = ?, updated_at = ? WHERE id = ?`,
        [status, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            const updated = await getRentalOrder(id);
            resolve(updated!);
          }
        }
      );
    }
  });
}

export async function createReturnInspection(data: {
  rental_order_id: string;
  inspector_name: string;
  has_scratches: boolean;
  scratches_description?: string;
  has_damage: boolean;
  damage_description?: string;
  accessories_complete: boolean;
  accessories_notes?: string;
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor';
  conclusion: string;
  returned_accessories?: Array<{ accessory_id: string; returned_quantity: number; status: string }>;
}): Promise<ReturnInspection> {
  const id = generateId();
  const now = getCurrentTime();

  const order = await getRentalOrder(data.rental_order_id);
  if (!order) throw new Error('Rental order not found');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `INSERT INTO return_inspections (id, rental_order_id, inspector_name, inspection_date, has_scratches, scratches_description, has_damage, damage_description, accessories_complete, accessories_notes, overall_condition, conclusion, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.rental_order_id, data.inspector_name, now, data.has_scratches ? 1 : 0, data.scratches_description, data.has_damage ? 1 : 0, data.damage_description, data.accessories_complete ? 1 : 0, data.accessories_notes, data.overall_condition, data.conclusion, 'pending', now]
      );

      if (data.returned_accessories && data.returned_accessories.length > 0) {
        data.returned_accessories.forEach(acc => {
          db.run(
            `UPDATE rental_accessories 
             SET returned_quantity = ?, status = ? 
             WHERE rental_order_id = ? AND accessory_id = ?`,
            [acc.returned_quantity, acc.status, data.rental_order_id, acc.accessory_id]
          );
        });
      } else if (data.accessories_complete) {
        db.run(
          `UPDATE rental_accessories 
           SET returned_quantity = expected_quantity, status = 'returned' 
           WHERE rental_order_id = ?`,
          [data.rental_order_id]
        );
      }

      db.run(
        `UPDATE rental_orders SET status = 'returned', updated_at = ?, actual_end_date = ? WHERE id = ?`,
        [now, now, data.rental_order_id],
        async (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            db.run(
              `UPDATE equipment SET status = 'available', updated_at = ? WHERE id = ?`,
              [now, order.equipment_id],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                } else {
                  db.run('COMMIT');
                  resolve({
                    id,
                    ...data,
                    inspection_date: now,
                    status: 'pending',
                    created_at: now,
                  } as ReturnInspection);
                }
              }
            );
          }
        }
      );
    });
  });
}

export async function createDepositDeduction(data: {
  rental_order_id: string;
  inspection_id?: string;
  amount: number;
  reason: string;
  requested_by: string;
  notes?: string;
}): Promise<DepositDeduction> {
  const id = generateId();
  const now = getCurrentTime();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO deposit_deductions (id, rental_order_id, inspection_id, amount, reason, requested_by, requested_at, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.rental_order_id, data.inspection_id, data.amount, data.reason, data.requested_by, now, 'pending', data.notes],
      (err) => {
        if (err) reject(err);
        else resolve({
          id,
          ...data,
          requested_at: now,
          status: 'pending',
        } as DepositDeduction);
      }
    );
  });
}

export async function approveDepositDeduction(id: string, approvedBy: string, approve: boolean): Promise<DepositDeduction> {
  const now = getCurrentTime();
  const status = approve ? 'approved' : 'rejected';
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE deposit_deductions SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?`,
      [status, approvedBy, now, id],
      async (err) => {
        if (err) reject(err);
        else {
          db.get(`SELECT * FROM deposit_deductions WHERE id = ?`, [id], (err, row: any) => {
            if (err) reject(err);
            else resolve(row as DepositDeduction);
          });
        }
      }
    );
  });
}

export async function createManualCorrection(data: {
  rental_order_id?: string;
  correction_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason: string;
  corrected_by: string;
}): Promise<void> {
  const id = generateId();
  const now = getCurrentTime();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO manual_corrections (id, rental_order_id, correction_type, field_name, old_value, new_value, reason, corrected_by, corrected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.rental_order_id, data.correction_type, data.field_name, data.old_value, data.new_value, data.reason, data.corrected_by, now],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export async function generateRentalReport(rentalOrderId: string): Promise<RentalReport> {
  const order = await getRentalOrder(rentalOrderId);
  if (!order) throw new Error('Rental order not found');

  const equipment = await getEquipment(order.equipment_id);
  if (!equipment) throw new Error('Equipment not found');

  const actualStart = order.actual_start_date || order.expected_start_date;
  const actualEnd = order.actual_end_date || order.expected_end_date;

  const { days: actualDays, fee: rentalFee } = calculateRentalFee(equipment.daily_rate, actualStart, actualEnd);
  const overdueDays = calculateOverdueDays(order.expected_end_date, actualEnd);
  const overdueFee = overdueDays * equipment.daily_rate * 1.5;

  const deductions: any[] = await new Promise((resolve, reject) => {
    db.all(
      `SELECT amount FROM deposit_deductions WHERE rental_order_id = ? AND status = 'approved'`,
      [rentalOrderId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0) + overdueFee;
  const depositRefund = Math.max(0, order.deposit_paid - totalDeductions);

  const inspection: any = await new Promise((resolve, reject) => {
    db.get(
      `SELECT conclusion FROM return_inspections WHERE rental_order_id = ? ORDER BY created_at DESC LIMIT 1`,
      [rentalOrderId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || { conclusion: '未检查' });
      }
    );
  });

  return {
    order_no: order.order_no,
    equipment_name: equipment.name,
    borrower_name: order.borrower_name,
    rental_period: `${actualStart} 至 ${actualEnd}`,
    actual_days: actualDays,
    rental_fee: rentalFee,
    overdue_days: overdueDays,
    overdue_fee: overdueFee,
    deposit_paid: order.deposit_paid,
    deductions: totalDeductions,
    deposit_refund: depositRefund,
    inspection_result: inspection.conclusion,
    status: order.status,
  };
}

export async function getExceptionLogs(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM exception_logs ORDER BY created_at DESC`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function getAccessories(equipmentId?: string): Promise<any[]> {
  const sql = equipmentId 
    ? `SELECT * FROM accessories WHERE equipment_id = ?`
    : `SELECT * FROM accessories`;
  const params = equipmentId ? [equipmentId] : [];
  
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function getRentalAccessories(rentalOrderId: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ra.*, a.name as accessory_name 
       FROM rental_accessories ra 
       JOIN accessories a ON ra.accessory_id = a.id 
       WHERE ra.rental_order_id = ?`,
      [rentalOrderId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}
