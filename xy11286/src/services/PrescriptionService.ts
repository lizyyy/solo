import { prescriptionModel } from '../models/Prescription';
import { inventoryModel } from '../models/Inventory';
import { auditLogModel } from '../models/AuditLog';
import { PrescriptionStatus, AuditAction, Prescription } from '../types';
import { withTransaction } from '../db/database';
import { maskEntityData } from '../utils/masking';

export class PrescriptionService {
  submitPrescription(prescriptionId: string, operatorId: string, operatorName: string): Prescription {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }
    if (prescription.status !== PrescriptionStatus.DRAFT) {
      throw new Error('只有草稿状态的处方可以提交');
    }

    prescriptionModel.updateStatus(prescriptionId, PrescriptionStatus.SUBMITTED);

    auditLogModel.create({
      entityType: 'prescription',
      entityId: prescriptionId,
      action: AuditAction.SUBMIT,
      operatorId,
      operatorName,
      oldValue: PrescriptionStatus.DRAFT,
      newValue: PrescriptionStatus.SUBMITTED,
      notes: '提交处方',
    });

    const updated = prescriptionModel.findById(prescriptionId)!;
    return maskEntityData(updated, 'prescription', 'display');
  }

  approvePrescription(prescriptionId: string, operatorId: string, operatorName: string, notes?: string): Prescription {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }
    if (prescription.status !== PrescriptionStatus.SUBMITTED) {
      throw new Error('只有已提交的处方可以审核通过');
    }

    const stockCheck = this.checkStockAvailability(prescriptionId);
    if (!stockCheck.available) {
      throw new Error(`库存不足: ${stockCheck.insufficientItems.map(i => i.medicineName).join(', ')}`);
    }

    prescriptionModel.updateStatus(prescriptionId, PrescriptionStatus.APPROVED, notes);

    auditLogModel.create({
      entityType: 'prescription',
      entityId: prescriptionId,
      action: AuditAction.APPROVE,
      operatorId,
      operatorName,
      oldValue: PrescriptionStatus.SUBMITTED,
      newValue: PrescriptionStatus.APPROVED,
      notes,
    });

    const updated = prescriptionModel.findById(prescriptionId)!;
    return maskEntityData(updated, 'prescription', 'display');
  }

  rejectPrescription(prescriptionId: string, operatorId: string, operatorName: string, reason: string): Prescription {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }
    if (prescription.status !== PrescriptionStatus.SUBMITTED) {
      throw new Error('只有已提交的处方可以驳回');
    }

    prescriptionModel.updateStatus(prescriptionId, PrescriptionStatus.REJECTED, reason);

    auditLogModel.create({
      entityType: 'prescription',
      entityId: prescriptionId,
      action: AuditAction.REJECT,
      operatorId,
      operatorName,
      oldValue: PrescriptionStatus.SUBMITTED,
      newValue: PrescriptionStatus.REJECTED,
      notes: reason,
    });

    const updated = prescriptionModel.findById(prescriptionId)!;
    return maskEntityData(updated, 'prescription', 'display');
  }

  blockPrescription(prescriptionId: string, operatorId: string, operatorName: string, reason: string): Prescription {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }

    const validStatuses = [PrescriptionStatus.SUBMITTED, PrescriptionStatus.APPROVED];
    if (!validStatuses.includes(prescription.status as PrescriptionStatus)) {
      throw new Error('只有已提交或已审核的处方可以拦截');
    }

    prescriptionModel.updateStatus(prescriptionId, PrescriptionStatus.BLOCKED, reason);

    auditLogModel.create({
      entityType: 'prescription',
      entityId: prescriptionId,
      action: AuditAction.BLOCK,
      operatorId,
      operatorName,
      oldValue: prescription.status,
      newValue: PrescriptionStatus.BLOCKED,
      notes: reason,
    });

    const updated = prescriptionModel.findById(prescriptionId)!;
    return maskEntityData(updated, 'prescription', 'display');
  }

  dispensePrescription(prescriptionId: string, operatorId: string, operatorName: string): Prescription {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }
    if (prescription.status !== PrescriptionStatus.APPROVED) {
      throw new Error('只有已审核通过的处方可以发药');
    }

    const stockCheck = this.checkStockAvailability(prescriptionId);
    if (!stockCheck.available) {
      throw new Error(`库存不足: ${stockCheck.insufficientItems.map(i => i.medicineName).join(', ')}`);
    }

    withTransaction(() => {
      const items = prescriptionModel.getItems(prescriptionId);

      for (const item of items) {
        const batches = inventoryModel.findAvailableByMedicineId(item.medicineId);
        let remainingQuantity = item.requestedQuantity;

        for (const batch of batches) {
          if (remainingQuantity <= 0) break;

          const deductQuantity = Math.min(remainingQuantity, batch.quantity);
          inventoryModel.deductStock(batch.id, deductQuantity);
          remainingQuantity -= deductQuantity;

          prescriptionModel.updateItemDispensed(item.id, item.requestedQuantity, batch.id, batch.batchNumber);
        }
      }

      prescriptionModel.updateStatus(prescriptionId, PrescriptionStatus.DISPENSED);

      auditLogModel.create({
        entityType: 'prescription',
        entityId: prescriptionId,
        action: AuditAction.DISPENSE,
        operatorId,
        operatorName,
        oldValue: PrescriptionStatus.APPROVED,
        newValue: PrescriptionStatus.DISPENSED,
        notes: '完成发药',
      });
    });

    const updated = prescriptionModel.findById(prescriptionId)!;
    return maskEntityData(updated, 'prescription', 'display');
  }

  checkStockAvailability(prescriptionId: string): { 
    available: boolean; 
    insufficientItems: Array<{
      medicineId: string;
      medicineName: string;
      requested: number;
      available: number;
    }> 
  } {
    const prescription = prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('处方不存在');
    }

    const insufficientItems: Array<{
      medicineId: string;
      medicineName: string;
      requested: number;
      available: number;
    }> = [];

    for (const item of prescription.items) {
      const availableQuantity = inventoryModel.getTotalQuantity(item.medicineId);
      if (availableQuantity < item.requestedQuantity) {
        insufficientItems.push({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          requested: item.requestedQuantity,
          available: availableQuantity,
        });
      }
    }

    return {
      available: insufficientItems.length === 0,
      insufficientItems,
    };
  }

  getPrescriptionAuditTrail(prescriptionId: string): any[] {
    const logs = auditLogModel.findByEntity('prescription', prescriptionId);
    return logs.map(log => ({
      ...log,
      operatorName: log.operatorName,
    }));
  }

  getPrescriptionByNumber(prescriptionNumber: string): Prescription | undefined {
    const prescription = prescriptionModel.findByPrescriptionNumber(prescriptionNumber);
    if (prescription) {
      return maskEntityData(prescription, 'prescription', 'display');
    }
    return undefined;
  }

  getPrescriptionsByStatus(status: PrescriptionStatus): Prescription[] {
    const prescriptions = prescriptionModel.findByStatus(status);
    return prescriptions.map(p => maskEntityData(p, 'prescription', 'display'));
  }

  getPrescriptionsByDoctor(doctorId: string): Prescription[] {
    const prescriptions = prescriptionModel.findByDoctorId(doctorId);
    return prescriptions.map(p => maskEntityData(p, 'prescription', 'display'));
  }

  getPrescriptionsByPet(petId: string): Prescription[] {
    const prescriptions = prescriptionModel.findByPetId(petId);
    return prescriptions.map(p => maskEntityData(p, 'prescription', 'display'));
  }
}

export const prescriptionService = new PrescriptionService();