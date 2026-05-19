import fs from 'fs';
import path from 'path';
import { prescriptionModel } from '../models/Prescription';
import { medicineModel } from '../models/Medicine';
import { badRecordModel } from '../models/BadRecord';
import { importSessionModel } from '../models/ImportSession';
import { PrescriptionStatus, PrescriptionItem } from '../types';
import { withTransaction } from '../db/database';

interface PrescriptionImportData {
  prescriptionNumber: string;
  doctorId: string;
  doctorName: string;
  petId: string;
  petName: string;
  petSpecies: string;
  petWeight: number;
  petWeightUnit: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  diagnosis: string;
  items: {
    medicineCode: string;
    medicineName: string;
    requestedQuantity: number;
    unit: string;
    dosage: string;
    notes?: string;
  }[];
  notes?: string;
}

export class PrescriptionImporter {
  private sourceFile: string;
  private operatorId: string;
  private operatorName: string;

  constructor(sourceFile: string, operatorId: string, operatorName: string) {
    this.sourceFile = sourceFile;
    this.operatorId = operatorId;
    this.operatorName = operatorName;
  }

  import(): { sessionId: string; successCount: number; failureCount: number; badRecords: any[] } {
    const content = fs.readFileSync(this.sourceFile, 'utf8');
    const fileHash = importSessionModel.calculateFileHash(content);

    const existingSession = importSessionModel.findByFileHash('prescription', fileHash);
    if (existingSession && existingSession.status === 'completed') {
      throw new Error(`该文件已在 ${new Date(existingSession.startedAt).toLocaleString()} 成功导入，避免重复导入`);
    }

    const prescriptionsData = this.parseJSON(content);
    const session = importSessionModel.create({
      importType: 'prescription',
      sourceFile: path.basename(this.sourceFile),
      fileHash,
      totalRecords: prescriptionsData.length,
      successCount: 0,
      failureCount: 0,
      status: 'processing',
      operatorId: this.operatorId,
      operatorName: this.operatorName,
    });

    let successCount = 0;
    let failureCount = 0;
    const badRecords: any[] = [];

    withTransaction(() => {
      for (let i = 0; i < prescriptionsData.length; i++) {
        const data = prescriptionsData[i];
        const rowNumber = i + 1;

        try {
          this.validatePrescription(data, rowNumber);
          this.importPrescription(data, session.id);
          successCount++;
        } catch (error: any) {
          const badRecord = badRecordModel.create({
            importId: session.id,
            importType: 'prescription',
            sourceFile: path.basename(this.sourceFile),
            rowNumber,
            columnName: error.columnName,
            originalData: JSON.stringify(data),
            failureReason: error.message,
            suggestedFix: error.suggestedFix || '请检查处方数据',
          });
          badRecords.push(badRecord);
          failureCount++;
        }
      }

      importSessionModel.complete(session.id, successCount, failureCount);
    });

    return { sessionId: session.id, successCount, failureCount, badRecords };
  }

  private parseJSON(content: string): PrescriptionImportData[] {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [data];
  }

  private validatePrescription(data: PrescriptionImportData, rowNumber: number): void {
    const errors: string[] = [];
    let columnName: string | undefined;

    if (!data.prescriptionNumber?.trim()) {
      errors.push('处方号不能为空');
      columnName = 'prescriptionNumber';
    } else {
      const existing = prescriptionModel.findByPrescriptionNumber(data.prescriptionNumber);
      if (existing) {
        errors.push(`处方号 ${data.prescriptionNumber} 已存在`);
        columnName = 'prescriptionNumber';
      }
    }

    if (!data.doctorId?.trim()) {
      errors.push('医生ID不能为空');
      columnName = columnName || 'doctorId';
    }

    if (!data.doctorName?.trim()) {
      errors.push('医生姓名不能为空');
      columnName = columnName || 'doctorName';
    }

    if (!data.petId?.trim()) {
      errors.push('宠物ID不能为空');
      columnName = columnName || 'petId';
    }

    if (!data.petName?.trim()) {
      errors.push('宠物姓名不能为空');
      columnName = columnName || 'petName';
    }

    if (!data.petSpecies?.trim()) {
      errors.push('宠物品类不能为空');
      columnName = columnName || 'petSpecies';
    }

    if (typeof data.petWeight !== 'number' || data.petWeight <= 0) {
      errors.push('宠物体重必须为正数');
      columnName = columnName || 'petWeight';
    }

    if (!data.petWeightUnit?.trim()) {
      errors.push('体重单位不能为空');
      columnName = columnName || 'petWeightUnit';
    }

    if (!data.ownerId?.trim()) {
      errors.push('主人ID不能为空');
      columnName = columnName || 'ownerId';
    }

    if (!data.ownerName?.trim()) {
      errors.push('主人姓名不能为空');
      columnName = columnName || 'ownerName';
    }

    if (!data.ownerPhone?.trim()) {
      errors.push('主人电话不能为空');
      columnName = columnName || 'ownerPhone';
    }

    if (!data.diagnosis?.trim()) {
      errors.push('诊断不能为空');
      columnName = columnName || 'diagnosis';
    }

    if (!data.items || data.items.length === 0) {
      errors.push('处方必须包含至少一条药品项目');
      columnName = columnName || 'items';
    } else {
      for (let j = 0; j < data.items.length; j++) {
        const item = data.items[j];
        if (!item.medicineCode?.trim()) {
          errors.push(`第${j + 1}条药品编码不能为空`);
          columnName = columnName || `items[${j}].medicineCode`;
        } else {
          const medicine = medicineModel.findByCode(item.medicineCode);
          if (!medicine) {
            errors.push(`第${j + 1}条药品编码 ${item.medicineCode} 不存在`);
            columnName = columnName || `items[${j}].medicineCode`;
          }
        }
        if (typeof item.requestedQuantity !== 'number' || item.requestedQuantity <= 0) {
          errors.push(`第${j + 1}条药品数量必须为正数`);
          columnName = columnName || `items[${j}].requestedQuantity`;
        }
        if (!item.unit?.trim()) {
          errors.push(`第${j + 1}条药品单位不能为空`);
          columnName = columnName || `items[${j}].unit`;
        }
        if (!item.dosage?.trim()) {
          errors.push(`第${j + 1}条药品用法用量不能为空`);
          columnName = columnName || `items[${j}].dosage`;
        }
      }
    }

    if (errors.length > 0) {
      const error: any = new Error(errors.join('; '));
      error.columnName = columnName;
      error.suggestedFix = '请检查并修正上述错误后重新导入';
      throw error;
    }
  }

  private importPrescription(data: PrescriptionImportData, importId: string): void {
    const items: Omit<PrescriptionItem, 'id' | 'prescriptionId'>[] = data.items.map(item => {
      const medicine = medicineModel.findByCode(item.medicineCode)!;
      return {
        medicineId: medicine.id,
        medicineName: item.medicineName,
        requestedQuantity: item.requestedQuantity,
        dispensedQuantity: 0,
        unit: item.unit,
        dosage: item.dosage,
        notes: item.notes,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.requestedQuantity, 0);

    prescriptionModel.create({
      prescriptionNumber: data.prescriptionNumber,
      doctorId: data.doctorId,
      doctorName: data.doctorName,
      petId: data.petId,
      petName: data.petName,
      petSpecies: data.petSpecies,
      petWeight: data.petWeight,
      petWeightUnit: data.petWeightUnit,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      diagnosis: data.diagnosis,
      status: PrescriptionStatus.DRAFT,
      totalAmount,
      notes: data.notes,
      importId,
    }, items);
  }
}