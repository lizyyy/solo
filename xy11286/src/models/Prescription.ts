import { BaseModel } from './BaseModel';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../types';
import { withTransaction } from '../db/database';

export class PrescriptionModel extends BaseModel {
  protected tableName = 'prescriptions';

  create(data: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>, items: Omit<PrescriptionItem, 'id' | 'prescriptionId'>[]): Prescription {
    return withTransaction(() => {
      const id = this.generateId();
      const now = Date.now();

      this.db.prepare(`
        INSERT INTO prescriptions (
          id, prescription_number, doctor_id, doctor_name, pet_id, pet_name,
          pet_species, pet_weight, pet_weight_unit, owner_id, owner_name, owner_phone,
          diagnosis, status, total_amount, notes, import_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.prescriptionNumber, data.doctorId, data.doctorName,
        data.petId, data.petName, data.petSpecies, data.petWeight, data.petWeightUnit,
        data.ownerId, data.ownerName, data.ownerPhone, data.diagnosis,
        data.status, data.totalAmount, data.notes || null, data.importId || null,
        now, now
      );

      const insertItem = this.db.prepare(`
        INSERT INTO prescription_items (
          id, prescription_id, medicine_id, medicine_name, batch_id, batch_number,
          requested_quantity, dispensed_quantity, unit, dosage, dosage_calculation, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const itemId = this.generateId();
        insertItem.run(
          itemId, id, item.medicineId, item.medicineName,
          item.batchId || null, item.batchNumber || null,
          item.requestedQuantity, item.dispensedQuantity,
          item.unit, item.dosage,
          item.dosageCalculation ? JSON.stringify(item.dosageCalculation) : null,
          item.notes || null
        );
      }

      return { ...data, id, createdAt: now, updatedAt: now, items: items.map((item, index) => ({ ...item, id: 'temp', prescriptionId: id })) };
    });
  }

  updateStatus(id: string, status: PrescriptionStatus, reason?: string): boolean {
    const now = Date.now();
    const setClauses: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (status === PrescriptionStatus.REJECTED && reason) {
      setClauses.push('rejection_reason = ?');
      params.push(reason);
    }
    if (status === PrescriptionStatus.BLOCKED && reason) {
      setClauses.push('block_reason = ?');
      params.push(reason);
    }
    if (status === PrescriptionStatus.SUBMITTED) {
      setClauses.push('submitted_at = ?');
      params.push(now);
    }
    if (status === PrescriptionStatus.APPROVED) {
      setClauses.push('approved_at = ?');
      params.push(now);
    }
    if (status === PrescriptionStatus.DISPENSED) {
      setClauses.push('dispensed_at = ?');
      params.push(now);
    }

    params.push(id);
    const result = this.db.prepare(`
      UPDATE prescriptions SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...params);

    return result.changes > 0;
  }

  findByPrescriptionNumber(prescriptionNumber: string): Prescription | undefined {
    const row = this.db.prepare('SELECT * FROM prescriptions WHERE prescription_number = ?').get(prescriptionNumber);
    if (!row) return undefined;
    return this.getFullPrescription(row as any);
  }

  findById(id: string): Prescription | undefined {
    const row = this.db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id);
    if (!row) return undefined;
    return this.getFullPrescription(row as any);
  }

  findByStatus(status: PrescriptionStatus): Prescription[] {
    const rows = this.db.prepare('SELECT * FROM prescriptions WHERE status = ? ORDER BY created_at DESC').all(status);
    return (rows as any[]).map(row => this.getFullPrescription(row));
  }

  findByDoctorId(doctorId: string): Prescription[] {
    const rows = this.db.prepare('SELECT * FROM prescriptions WHERE doctor_id = ? ORDER BY created_at DESC').all(doctorId);
    return (rows as any[]).map(row => this.getFullPrescription(row));
  }

  findByPetId(petId: string): Prescription[] {
    const rows = this.db.prepare('SELECT * FROM prescriptions WHERE pet_id = ? ORDER BY created_at DESC').all(petId);
    return (rows as any[]).map(row => this.getFullPrescription(row));
  }

  private getFullPrescription(row: any): Prescription {
    const items = this.db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(row.id);
    return {
      id: row.id,
      prescriptionNumber: row.prescription_number,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      petId: row.pet_id,
      petName: row.pet_name,
      petSpecies: row.pet_species,
      petWeight: row.pet_weight,
      petWeightUnit: row.pet_weight_unit,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      diagnosis: row.diagnosis,
      status: row.status as PrescriptionStatus,
      totalAmount: row.total_amount,
      notes: row.notes,
      rejectionReason: row.rejection_reason,
      blockReason: row.block_reason,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      approvedAt: row.approved_at,
      dispensedAt: row.dispensed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      importId: row.import_id,
      items: (items as any[]).map(this.mapRowToItem),
    };
  }

  private mapRowToItem(row: any): PrescriptionItem {
    return {
      id: row.id,
      prescriptionId: row.prescription_id,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name,
      batchId: row.batch_id,
      batchNumber: row.batch_number,
      requestedQuantity: row.requested_quantity,
      dispensedQuantity: row.dispensed_quantity,
      unit: row.unit,
      dosage: row.dosage,
      dosageCalculation: row.dosage_calculation ? JSON.parse(row.dosage_calculation) : undefined,
      notes: row.notes,
    };
  }

  updateItemDispensed(itemId: string, dispensedQuantity: number, batchId?: string, batchNumber?: string): boolean {
    const setClauses: string[] = ['dispensed_quantity = ?'];
    const params: any[] = [dispensedQuantity];

    if (batchId) {
      setClauses.push('batch_id = ?');
      params.push(batchId);
    }
    if (batchNumber) {
      setClauses.push('batch_number = ?');
      params.push(batchNumber);
    }

    params.push(itemId);
    const result = this.db.prepare(`
      UPDATE prescription_items SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...params);

    return result.changes > 0;
  }

  getItems(prescriptionId: string): PrescriptionItem[] {
    const rows = this.db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(prescriptionId);
    return (rows as any[]).map(this.mapRowToItem);
  }
}

export const prescriptionModel = new PrescriptionModel();