import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import {
  Bed,
  Patient,
  CleaningWorkOrder,
  Discrepancy,
  DiscrepancyType,
  BedStatus,
  PatientStatus,
  CleaningStatus,
  DataSource,
  ReconciliationRecord
} from '../types';
import { dataStore } from '../models/DataStore';

export class ReconciliationEngine {
  private readonly CLEANING_TIMEOUT_MINUTES = 120;

  async runReconciliation(performedBy: string, ward?: string): Promise<ReconciliationRecord> {
    const record: ReconciliationRecord = {
      id: uuidv4(),
      batchId: `BATCH-${Date.now()}`,
      reconciliationDate: new Date(),
      ward,
      totalBeds: 0,
      occupiedBeds: 0,
      vacantBeds: 0,
      cleaningBeds: 0,
      lockedBeds: 0,
      totalPatients: 0,
      admittedPatients: 0,
      dischargedPatients: 0,
      transferredPatients: 0,
      totalWorkOrders: 0,
      pendingCleaning: 0,
      inProgressCleaning: 0,
      completedCleaning: 0,
      overdueCleaning: 0,
      discrepanciesFound: 0,
      discrepanciesResolved: 0,
      discrepanciesPending: 0,
      performedBy,
      status: 'in_progress',
      startedAt: new Date()
    };

    dataStore.clearDiscrepancies();

    const allBeds = dataStore.getAllBeds();
    const allPatients = dataStore.getAllPatients();
    const allWorkOrders = dataStore.getAllWorkOrders();

    const filteredBeds = ward 
      ? allBeds.filter(b => b.ward === ward) 
      : allBeds;

    this.updateReconciliationStats(record, filteredBeds, allPatients, allWorkOrders);

    const discrepancies: Discrepancy[] = [];

    discrepancies.push(...this.checkStatusMismatch(filteredBeds, allPatients));
    discrepancies.push(...this.checkDuplicateOccupancy(allPatients));
    discrepancies.push(...this.checkTransferLockBed(filteredBeds, allPatients));
    discrepancies.push(...this.checkCleaningTimeout(allWorkOrders));
    discrepancies.push(...this.checkPatientsInCleaning(filteredBeds, allWorkOrders));
    discrepancies.push(...this.checkDataConsistency(allBeds, allPatients, allWorkOrders));

    discrepancies.forEach(d => dataStore.addDiscrepancy(d));

    record.discrepanciesFound = discrepancies.length;
    record.discrepanciesPending = discrepancies.filter(d => !d.isResolved).length;
    record.status = 'completed';
    record.completedAt = new Date();

    dataStore.addReconciliationRecord(record);

    dataStore.addAuditLog({
      action: 'reconciliation_run',
      entityType: 'reconciliation',
      entityId: record.id,
      performedBy,
      notes: `Found ${discrepancies.length} discrepancies`,
      source: DataSource.BED_CSV
    });

    return record;
  }

  private updateReconciliationStats(
    record: ReconciliationRecord,
    beds: Bed[],
    patients: Patient[],
    workOrders: CleaningWorkOrder[]
  ): void {
    record.totalBeds = beds.length;
    record.occupiedBeds = beds.filter(b => b.status === BedStatus.OCCUPIED).length;
    record.vacantBeds = beds.filter(b => b.status === BedStatus.VACANT).length;
    record.cleaningBeds = beds.filter(b => b.status === BedStatus.CLEANING).length;
    record.lockedBeds = beds.filter(b => b.status === BedStatus.LOCKED || b.isLocked).length;

    record.totalPatients = patients.length;
    record.admittedPatients = patients.filter(p => p.status === PatientStatus.ADMITTED).length;
    record.dischargedPatients = patients.filter(p => p.status === PatientStatus.DISCHARGED).length;
    record.transferredPatients = patients.filter(p => p.status === PatientStatus.TRANSFERRED).length;

    record.totalWorkOrders = workOrders.length;
    record.pendingCleaning = workOrders.filter(wo => wo.status === CleaningStatus.PENDING).length;
    record.inProgressCleaning = workOrders.filter(wo => wo.status === CleaningStatus.IN_PROGRESS).length;
    record.completedCleaning = workOrders.filter(wo => wo.status === CleaningStatus.COMPLETED).length;
    record.overdueCleaning = workOrders.filter(wo => wo.status === CleaningStatus.OVERDUE).length;
  }

  private checkStatusMismatch(beds: Bed[], patients: Patient[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    beds.forEach(bed => {
      const patient = patients.find(p => 
        bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId)
      );

      if (bed.status === BedStatus.OCCUPIED && !patient && bed.currentPatientId) {
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.STATUS_MISMATCH,
          'high',
          bed,
          undefined,
          undefined,
          '床位状态不一致',
          `床位 ${bed.bedNumber} 标记为占用状态，但未找到患者 ${bed.currentPatientId} 的流转记录。可能患者数据缺失或床位表错误`,
          { bedStatus: bed.status }
        ));
      }

      if (bed.status === BedStatus.OCCUPIED && patient && patient.status !== PatientStatus.ADMITTED) {
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.STATUS_MISMATCH,
          'critical',
          bed,
          patient,
          undefined,
          '床位与患者状态不一致',
          `床位 ${bed.bedNumber} 标记为占用，但患者 ${patient.name} (${patient.medicalRecordNumber}) 状态为 ${patient.status}（应为 admitted）`,
          { bedStatus: bed.status, patientStatus: patient.status }
        ));
      }

      if (bed.status === BedStatus.VACANT) {
        const patientInBed = patients.find(p => 
          p.currentBedId === bed.id || p.currentBedId === bed.bedNumber
        );
        if (patientInBed && patientInBed.status === PatientStatus.ADMITTED) {
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.STATUS_MISMATCH,
            'high',
            bed,
            patientInBed,
            undefined,
            '床位与患者状态不一致',
            `床位 ${bed.bedNumber} 标记为空床，但患者 ${patientInBed.name} 状态为住院中。可能患者转出记录缺失`,
            { bedStatus: bed.status, patientStatus: patientInBed.status }
          ));
        }
      }
    });

    return discrepancies;
  }

  private checkDuplicateOccupancy(patients: Patient[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const bedPatientMap = new Map<string, Patient[]>();

    patients.filter(p => p.currentBedId && p.status === PatientStatus.ADMITTED)
      .forEach(patient => {
        if (patient.currentBedId) {
          const existing = bedPatientMap.get(patient.currentBedId) || [];
          existing.push(patient);
          bedPatientMap.set(patient.currentBedId, existing);
        }
      });

    bedPatientMap.forEach((patientList) => {
      if (patientList.length > 1) {
        const bed = dataStore.getBed(patientList[0].currentBedId!);
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.DUPLICATE_OCCUPANCY,
          'critical',
          bed,
          patientList[0],
          undefined,
          '重复占用床位',
          `床位 ${bed?.bedNumber || 'unknown'} 被 ${patientList.length} 名患者同时占用: ${patientList.map(p => p.name).join(', ')}`,
          { bedStatus: bed?.status }
        ));
      }
    });

    return discrepancies;
  }

  private checkTransferLockBed(beds: Bed[], patients: Patient[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    beds.forEach(bed => {
      if (bed.status === BedStatus.TRANSFER || bed.isLocked) {
        const patient = patients.find(p => 
          bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId)
        );
        
        if (patient && patient.status !== PatientStatus.TRANSFERRED) {
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.TRANSFER_LOCK_BED,
            'high',
            bed,
            patient,
            undefined,
            '转科锁床状态不一致',
            `床位 ${bed.bedNumber} 标记为转科/锁定状态，但患者 ${patient.name} (${patient.medicalRecordNumber}) 状态为 ${patient.status}。可能转科记录未同步`,
            { bedStatus: bed.status, patientStatus: patient.status }
          ));
        }

        if (!patient && bed.status === BedStatus.TRANSFER && bed.currentPatientId) {
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.TRANSFER_LOCK_BED,
            'medium',
            bed,
            undefined,
            undefined,
            '转科锁床无关联患者',
            `床位 ${bed.bedNumber} 标记为转科状态，关联患者 ${bed.currentPatientId} 不存在。可能转科已完成但床位未解锁`,
            { bedStatus: bed.status }
          ));
        }
      }

      if (bed.status === BedStatus.TRANSFER && !bed.isLocked) {
        const patient = patients.find(p => 
          bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId)
        );
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.TRANSFER_LOCK_BED,
          'medium',
          bed,
          patient,
          undefined,
          '转科床位未锁定',
          `床位 ${bed.bedNumber} 标记为转科状态但未锁定，可能存在状态不一致`,
          { bedStatus: bed.status }
        ));
      }
    });

    return discrepancies;
  }

  private checkCleaningTimeout(workOrders: CleaningWorkOrder[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const now = moment();

    workOrders.forEach(wo => {
      if (wo.status === CleaningStatus.IN_PROGRESS || wo.status === CleaningStatus.PENDING) {
        const startTime = moment(wo.startedAt || wo.requestedAt);
        const duration = now.diff(startTime, 'minutes');

        if (duration > this.CLEANING_TIMEOUT_MINUTES) {
          const bed = dataStore.getAllBeds().find(b => b.id === wo.bedId || b.bedNumber === wo.bedNumber);
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.CLEANING_TIMEOUT,
            'high',
            bed,
            undefined,
            wo,
            '清洁超时',
            `床位 ${wo.bedNumber} 清洁工作已超时 ${Math.round(duration - this.CLEANING_TIMEOUT_MINUTES)} 分钟。申请时间: ${moment(wo.requestedAt).format('YYYY-MM-DD HH:mm')}`,
            { cleaningStatus: wo.status }
          ));

          dataStore.updateWorkOrder(wo.id, { status: CleaningStatus.OVERDUE });
        }
      }
    });

    return discrepancies;
  }

  private checkPatientsInCleaning(beds: Bed[], workOrders: CleaningWorkOrder[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    beds.forEach(bed => {
      if (bed.status === BedStatus.CLEANING) {
        const patient = dataStore.getAllPatients().find(p => 
          p.currentBedId === bed.id || p.currentBedId === bed.bedNumber
        );
        if (patient && patient.status === PatientStatus.ADMITTED) {
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.BED_NOT_CLEANED,
            'critical',
            bed,
            patient,
            undefined,
            '清洁中床位仍有患者',
            `床位 ${bed.bedNumber} 标记为清洁中，但患者 ${patient.name} (${patient.medicalRecordNumber}) 仍在该床位且状态为住院中`,
            { bedStatus: bed.status, patientStatus: patient.status }
          ));
        }

        const recentWorkOrder = workOrders.find(wo => 
          (wo.bedId === bed.id || wo.bedNumber === bed.bedNumber) && 
          (wo.status === CleaningStatus.IN_PROGRESS || wo.status === CleaningStatus.PENDING)
        );
        if (!recentWorkOrder) {
          discrepancies.push(this.createDiscrepancy(
            DiscrepancyType.BED_NOT_CLEANED,
            'medium',
            bed,
            undefined,
            undefined,
            '床位标记为清洁中但无工单',
            `床位 ${bed.bedNumber} 标记为清洁状态，但没有对应的清洁工单`,
            { bedStatus: bed.status }
          ));
        }
      }
    });

    return discrepancies;
  }

  private checkDataConsistency(beds: Bed[], patients: Patient[], workOrders: CleaningWorkOrder[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const bedIdSet = new Set(beds.map(b => b.id));
    const bedNumberSet = new Set(beds.map(b => b.bedNumber));
    const patientIdSet = new Set(patients.map(p => p.id));
    const patientMRNSet = new Set(patients.map(p => p.medicalRecordNumber));

    patients.filter(p => p.currentBedId).forEach(patient => {
      const bedId = patient.currentBedId!;
      if (!bedIdSet.has(bedId) && !bedNumberSet.has(bedId)) {
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.DATA_INCONSISTENCY,
          'high',
          undefined,
          patient,
          undefined,
          '患者引用不存在床位',
          `患者 ${patient.name} (${patient.medicalRecordNumber}) 引用了不存在的床位: ${bedId}`,
          { patientStatus: patient.status }
        ));
      }
    });

    beds.filter(b => b.currentPatientId).forEach(bed => {
      const patientId = bed.currentPatientId!;
      if (!patientIdSet.has(patientId) && !patientMRNSet.has(patientId)) {
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.DATA_INCONSISTENCY,
          'high',
          bed,
          undefined,
          undefined,
          '床位引用不存在患者',
          `床位 ${bed.bedNumber} 引用了不存在的患者: ${patientId}`,
          { bedStatus: bed.status }
        ));
      }
    });

    workOrders.forEach(wo => {
      const bedId = wo.bedId;
      if (!bedIdSet.has(bedId) && !bedNumberSet.has(bedId)) {
        discrepancies.push(this.createDiscrepancy(
          DiscrepancyType.DATA_INCONSISTENCY,
          'medium',
          undefined,
          undefined,
          wo,
          '清洁工单引用不存在床位',
          `清洁工单引用了不存在的床位: ${bedId} (${wo.bedNumber})`,
          { cleaningStatus: wo.status }
        ));
      }
    });

    return discrepancies;
  }

  private createDiscrepancy(
    type: DiscrepancyType,
    severity: Discrepancy['severity'],
    bed: Bed | undefined,
    patient: Patient | undefined,
    workOrder: CleaningWorkOrder | undefined,
    description: string,
    detailedExplanation: string,
    sourceData: {
      bedStatus?: BedStatus;
      patientStatus?: PatientStatus;
      cleaningStatus?: CleaningStatus;
    }
  ): Discrepancy {
    return {
      id: uuidv4(),
      type,
      severity,
      bedId: bed?.id,
      bedNumber: bed?.bedNumber,
      patientId: patient?.id,
      patientName: patient?.name,
      workOrderId: workOrder?.id,
      description,
      detailedExplanation,
      sourceData,
      affectedFields: this.getAffectedFields(type),
      dataSources: this.getDataSources(type),
      detectedAt: new Date(),
      isResolved: false
    };
  }

  private getAffectedFields(type: DiscrepancyType): string[] {
    switch (type) {
      case DiscrepancyType.STATUS_MISMATCH:
        return ['bed.status', 'patient.status', 'bed.currentPatientId'];
      case DiscrepancyType.DUPLICATE_OCCUPANCY:
        return ['patient.currentBedId', 'bed.currentPatientId'];
      case DiscrepancyType.TRANSFER_LOCK_BED:
        return ['bed.status', 'bed.isLocked', 'patient.status'];
      case DiscrepancyType.CLEANING_TIMEOUT:
        return ['workOrder.status', 'workOrder.startedAt'];
      case DiscrepancyType.MISSING_PATIENT:
        return ['bed.currentPatientId', 'patient.status'];
      case DiscrepancyType.EXTRA_PATIENT:
        return ['patient.currentBedId'];
      case DiscrepancyType.BED_NOT_CLEANED:
        return ['bed.status', 'workOrder.status'];
      case DiscrepancyType.DATA_INCONSISTENCY:
        return ['id', 'reference'];
      default:
        return ['unknown'];
    }
  }

  private getDataSources(type: DiscrepancyType): DataSource[] {
    switch (type) {
      case DiscrepancyType.STATUS_MISMATCH:
      case DiscrepancyType.DUPLICATE_OCCUPANCY:
      case DiscrepancyType.MISSING_PATIENT:
      case DiscrepancyType.EXTRA_PATIENT:
        return [DataSource.BED_CSV, DataSource.PATIENT_JSON];
      case DiscrepancyType.TRANSFER_LOCK_BED:
        return [DataSource.BED_CSV, DataSource.PATIENT_JSON];
      case DiscrepancyType.CLEANING_TIMEOUT:
      case DiscrepancyType.BED_NOT_CLEANED:
        return [DataSource.BED_CSV, DataSource.CLEANING_WORKORDER];
      case DiscrepancyType.DATA_INCONSISTENCY:
        return [DataSource.BED_CSV, DataSource.PATIENT_JSON, DataSource.CLEANING_WORKORDER];
      default:
        return [DataSource.BED_CSV];
    }
  }

  getPatientHistoryTrace(patientId: string): {
    patient: Patient | undefined;
    history: any[];
    auditLogs: any[];
    relatedDiscrepancies: Discrepancy[];
  } {
    const patient = dataStore.getPatient(patientId);
    if (!patient) {
      return { patient: undefined, history: [], auditLogs: [], relatedDiscrepancies: [] };
    }

    const auditLogs = dataStore.getAuditLogsByEntity('patient', patientId);
    const relatedDiscrepancies = dataStore.getAllDiscrepancies().filter(d => d.patientId === patientId);

    const historyWithDetails = patient.history.map(h => ({
      ...h,
      timestamp: h.timestamp,
      source: h.source
    }));

    return {
      patient,
      history: historyWithDetails,
      auditLogs,
      relatedDiscrepancies
    };
  }
}

export const reconciliationEngine = new ReconciliationEngine();
