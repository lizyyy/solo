import * as fs from 'fs';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import {
  Bed,
  Patient,
  CleaningWorkOrder,
  BedStatus,
  PatientStatus,
  CleaningStatus,
  PatientOutcome,
  PatientHistoryRecord,
  DataSource,
  ImportResult
} from '../types';
import { dataStore } from '../models/DataStore';

export class ImportService {
  async importBedCSV(filePath: string): Promise<ImportResult<Bed>> {
    const results: Bed[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          try {
            const bed = this.parseBedRow(row, rowNumber);
            if (bed) {
              results.push(bed);
            }
          } catch (error) {
            errors.push(`Row ${rowNumber}: ${(error as Error).message}`);
          }
        })
        .on('end', () => {
          results.forEach(bed => dataStore.addBed(bed));
          
          resolve({
            success: errors.length === 0,
            totalRecords: rowNumber,
            importedRecords: results.length,
            failedRecords: errors.length,
            errors,
            warnings,
            data: results
          });
        })
        .on('error', (error) => {
          errors.push(`File read error: ${error.message}`);
          resolve({
            success: false,
            totalRecords: rowNumber,
            importedRecords: results.length,
            failedRecords: errors.length,
            errors,
            warnings,
            data: results
          });
        });
    });
  }

  private parseBedRow(row: any, rowNumber: number): Bed {
    const requiredFields = ['bedNumber', 'ward', 'room', 'status'];
    const missingFields = requiredFields.filter(field => !row[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const statusMap: Record<string, BedStatus> = {
      'occupied': BedStatus.OCCUPIED,
      'vacant': BedStatus.VACANT,
      'cleaning': BedStatus.CLEANING,
      'locked': BedStatus.LOCKED,
      'transfer': BedStatus.TRANSFER
    };

    const status = statusMap[row.status.toLowerCase()];
    if (!status) {
      throw new Error(`Invalid bed status: ${row.status}`);
    }

    const cleaningStatusMap: Record<string, CleaningStatus> = {
      'pending': CleaningStatus.PENDING,
      'in_progress': CleaningStatus.IN_PROGRESS,
      'completed': CleaningStatus.COMPLETED,
      'overdue': CleaningStatus.OVERDUE
    };

    return {
      id: row.bedNumber.trim(),
      bedNumber: row.bedNumber.trim(),
      ward: row.ward.trim(),
      room: row.room.trim(),
      status,
      currentPatientId: row.patientId?.trim() || undefined,
      isLocked: row.isLocked?.toLowerCase() === 'true' || status === BedStatus.LOCKED,
      lockReason: row.lockReason?.trim() || undefined,
      lockedBy: row.lockedBy?.trim() || undefined,
      lockedAt: row.lockedAt ? new Date(row.lockedAt) : undefined,
      lastCleanedAt: row.lastCleanedAt ? new Date(row.lastCleanedAt) : undefined,
      cleaningStatus: row.cleaningStatus ? cleaningStatusMap[row.cleaningStatus.toLowerCase()] : undefined,
      assignedNurse: row.assignedNurse?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: DataSource.BED_CSV
    };
  }

  async importPatientJSON(filePath: string): Promise<ImportResult<Patient>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const patientsData = Array.isArray(data) ? data : data.patients || [data];
      
      const results: Patient[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < patientsData.length; i++) {
        try {
          const patient = this.parsePatientData(patientsData[i]);
          results.push(patient);
        } catch (error) {
          errors.push(`Patient ${i + 1}: ${(error as Error).message}`);
        }
      }

      results.forEach(patient => dataStore.addPatient(patient));

      return {
        success: errors.length === 0,
        totalRecords: patientsData.length,
        importedRecords: results.length,
        failedRecords: errors.length,
        errors,
        warnings,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        importedRecords: 0,
        failedRecords: 1,
        errors: [`File read/parse error: ${(error as Error).message}`],
        warnings: [],
        data: []
      };
    }
  }

  private parsePatientData(data: any): Patient {
    const requiredFields = ['medicalRecordNumber', 'name', 'age', 'gender', 'diagnosis', 'status', 'admissionDate', 'attendingPhysician'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const statusMap: Record<string, PatientStatus> = {
      'admitted': PatientStatus.ADMITTED,
      'transferred': PatientStatus.TRANSFERRED,
      'discharged': PatientStatus.DISCHARGED
    };

    const status = statusMap[data.status.toLowerCase()];
    if (!status) {
      throw new Error(`Invalid patient status: ${data.status}`);
    }

    const outcomeMap: Record<string, PatientOutcome> = {
      'recovery_discharge': PatientOutcome.RECOVERY_DISCHARGE,
      'transfer_to_other_ward': PatientOutcome.TRANSFER_TO_OTHER_WARD,
      'transfer_to_icu': PatientOutcome.TRANSFER_TO_ICU,
      'death': PatientOutcome.DEATH,
      'autopsy': PatientOutcome.AUTOPSY,
      'other': PatientOutcome.OTHER
    };

    const normalizeBedId = (bedId: string | undefined): string | undefined => {
      if (!bedId) return undefined;
      return bedId.replace(/^BED_/, '').trim();
    };

    const history: PatientHistoryRecord[] = (data.history || []).map((h: any) => ({
      id: uuidv4(),
      timestamp: new Date(h.timestamp),
      action: h.action,
      previousStatus: h.previousStatus ? statusMap[h.previousStatus.toLowerCase()] : undefined,
      newStatus: h.newStatus ? statusMap[h.newStatus.toLowerCase()] : undefined,
      previousBedId: normalizeBedId(h.previousBedId),
      newBedId: normalizeBedId(h.newBedId),
      previousWard: h.previousWard,
      newWard: h.newWard,
      outcome: h.outcome ? outcomeMap[h.outcome.toLowerCase()] : undefined,
      performedBy: h.performedBy || 'system',
      notes: h.notes,
      source: DataSource.PATIENT_JSON
    }));

    return {
      id: data.medicalRecordNumber.trim(),
      medicalRecordNumber: data.medicalRecordNumber.trim(),
      name: data.name.trim(),
      age: parseInt(data.age, 10),
      gender: data.gender.trim(),
      diagnosis: data.diagnosis.trim(),
      status,
      currentBedId: normalizeBedId(data.bedId),
      admissionDate: new Date(data.admissionDate),
      expectedDischargeDate: data.expectedDischargeDate ? new Date(data.expectedDischargeDate) : undefined,
      actualDischargeDate: data.actualDischargeDate ? new Date(data.actualDischargeDate) : undefined,
      outcome: data.outcome ? outcomeMap[data.outcome.toLowerCase()] : undefined,
      outcomeNotes: data.outcomeNotes?.trim() || undefined,
      transferFromWard: data.transferFromWard?.trim() || undefined,
      transferToWard: data.transferToWard?.trim() || undefined,
      transferDate: data.transferDate ? new Date(data.transferDate) : undefined,
      attendingPhysician: data.attendingPhysician.trim(),
      responsibleNurse: data.responsibleNurse?.trim() || undefined,
      history,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: DataSource.PATIENT_JSON
    };
  }

  async importCleaningWorkOrdersJSON(filePath: string): Promise<ImportResult<CleaningWorkOrder>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const workOrdersData = Array.isArray(data) ? data : data.workOrders || [data];
      
      const results: CleaningWorkOrder[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < workOrdersData.length; i++) {
        try {
          const workOrder = this.parseCleaningWorkOrderData(workOrdersData[i]);
          results.push(workOrder);
        } catch (error) {
          errors.push(`WorkOrder ${i + 1}: ${(error as Error).message}`);
        }
      }

      results.forEach(wo => dataStore.addWorkOrder(wo));

      return {
        success: errors.length === 0,
        totalRecords: workOrdersData.length,
        importedRecords: results.length,
        failedRecords: errors.length,
        errors,
        warnings,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        importedRecords: 0,
        failedRecords: 1,
        errors: [`File read/parse error: ${(error as Error).message}`],
        warnings: [],
        data: []
      };
    }
  }

  private parseCleaningWorkOrderData(data: any): CleaningWorkOrder {
    const requiredFields = ['bedId', 'bedNumber', 'ward', 'requestedBy', 'requestedAt', 'status'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const statusMap: Record<string, CleaningStatus> = {
      'pending': CleaningStatus.PENDING,
      'in_progress': CleaningStatus.IN_PROGRESS,
      'completed': CleaningStatus.COMPLETED,
      'overdue': CleaningStatus.OVERDUE
    };

    const status = statusMap[data.status.toLowerCase()];
    if (!status) {
      throw new Error(`Invalid cleaning status: ${data.status}`);
    }

    const normalizeBedId = (bedId: string | undefined): string | undefined => {
      if (!bedId) return undefined;
      return bedId.replace(/^BED_/, '').trim();
    };

    const normalizePatientId = (patientId: string | undefined): string | undefined => {
      if (!patientId || patientId === '') return undefined;
      return patientId.trim();
    };

    return {
      id: uuidv4(),
      bedId: normalizeBedId(data.bedId) || data.bedNumber.trim(),
      bedNumber: data.bedNumber.trim(),
      ward: data.ward.trim(),
      patientId: normalizePatientId(data.patientId),
      patientName: data.patientName?.trim() || undefined,
      requestedBy: data.requestedBy.trim(),
      requestedAt: new Date(data.requestedAt),
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      status,
      assignedTo: data.assignedTo?.trim() || undefined,
      priority: data.priority?.toLowerCase() === 'urgent' ? 'urgent' : 'normal',
      notes: data.notes?.trim() || undefined,
      cleaningDurationMinutes: data.cleaningDurationMinutes ? parseInt(data.cleaningDurationMinutes, 10) : undefined,
      qualityCheckPassed: data.qualityCheckPassed !== undefined ? data.qualityCheckPassed === true : undefined,
      checkedBy: data.checkedBy?.trim() || undefined,
      checkedAt: data.checkedAt ? new Date(data.checkedAt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: DataSource.CLEANING_WORKORDER
    };
  }

  validateBedPatientConsistency(): { valid: boolean; issues: string[] } {
    const beds = dataStore.getAllBeds();
    const patients = dataStore.getAllPatients();
    const workOrders = dataStore.getAllWorkOrders();
    const issues: string[] = [];

    beds.forEach(bed => {
      if (bed.currentPatientId && bed.status === BedStatus.VACANT) {
        issues.push(`床位 ${bed.bedNumber} 标记为空床但有关联患者 ${bed.currentPatientId}`);
      }
      if (bed.currentPatientId) {
        const patient = patients.find(p => p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId);
        if (!patient) {
          issues.push(`床位 ${bed.bedNumber} 引用不存在的患者 ${bed.currentPatientId}`);
        } else if (patient.currentBedId !== bed.id && patient.currentBedId !== bed.bedNumber) {
          issues.push(`患者 ${patient.name} 不在床位 ${bed.bedNumber} 上，但床位引用了该患者`);
        }
      }
    });

    patients.forEach(patient => {
      if (patient.currentBedId) {
        const bed = beds.find(b => b.id === patient.currentBedId || b.bedNumber === patient.currentBedId);
        if (!bed) {
          issues.push(`患者 ${patient.name} (${patient.medicalRecordNumber}) 引用不存在的床位 ${patient.currentBedId}`);
        } else if (bed.currentPatientId !== patient.id && bed.currentPatientId !== patient.medicalRecordNumber) {
          issues.push(`床位 ${bed.bedNumber} 未分配给患者 ${patient.name}，但患者引用了该床位`);
        }
      }
    });

    workOrders.forEach(wo => {
      const bed = beds.find(b => b.id === wo.bedId || b.bedNumber === wo.bedNumber);
      if (!bed) {
        issues.push(`清洁工单 ${wo.id} 引用不存在的床位 ${wo.bedId} (${wo.bedNumber})`);
      }
    });

    return { valid: issues.length === 0, issues };
  }
}

export const importService = new ImportService();
