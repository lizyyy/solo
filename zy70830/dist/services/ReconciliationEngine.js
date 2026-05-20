"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationEngine = exports.ReconciliationEngine = void 0;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const types_1 = require("../types");
const DataStore_1 = require("../models/DataStore");
class ReconciliationEngine {
    constructor() {
        this.CLEANING_TIMEOUT_MINUTES = 120;
    }
    async runReconciliation(performedBy, ward) {
        const record = {
            id: (0, uuid_1.v4)(),
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
        DataStore_1.dataStore.clearDiscrepancies();
        const allBeds = DataStore_1.dataStore.getAllBeds();
        const allPatients = DataStore_1.dataStore.getAllPatients();
        const allWorkOrders = DataStore_1.dataStore.getAllWorkOrders();
        const filteredBeds = ward
            ? allBeds.filter(b => b.ward === ward)
            : allBeds;
        this.updateReconciliationStats(record, filteredBeds, allPatients, allWorkOrders);
        const discrepancies = [];
        discrepancies.push(...this.checkStatusMismatch(filteredBeds, allPatients));
        discrepancies.push(...this.checkDuplicateOccupancy(allPatients));
        discrepancies.push(...this.checkTransferLockBed(filteredBeds, allPatients));
        discrepancies.push(...this.checkCleaningTimeout(allWorkOrders));
        discrepancies.push(...this.checkPatientsInCleaning(filteredBeds, allWorkOrders));
        discrepancies.push(...this.checkDataConsistency(allBeds, allPatients, allWorkOrders));
        discrepancies.forEach(d => DataStore_1.dataStore.addDiscrepancy(d));
        record.discrepanciesFound = discrepancies.length;
        record.discrepanciesPending = discrepancies.filter(d => !d.isResolved).length;
        record.status = 'completed';
        record.completedAt = new Date();
        DataStore_1.dataStore.addReconciliationRecord(record);
        DataStore_1.dataStore.addAuditLog({
            action: 'reconciliation_run',
            entityType: 'reconciliation',
            entityId: record.id,
            performedBy,
            notes: `Found ${discrepancies.length} discrepancies`,
            source: types_1.DataSource.BED_CSV
        });
        return record;
    }
    updateReconciliationStats(record, beds, patients, workOrders) {
        record.totalBeds = beds.length;
        record.occupiedBeds = beds.filter(b => b.status === types_1.BedStatus.OCCUPIED).length;
        record.vacantBeds = beds.filter(b => b.status === types_1.BedStatus.VACANT).length;
        record.cleaningBeds = beds.filter(b => b.status === types_1.BedStatus.CLEANING).length;
        record.lockedBeds = beds.filter(b => b.status === types_1.BedStatus.LOCKED || b.isLocked).length;
        record.totalPatients = patients.length;
        record.admittedPatients = patients.filter(p => p.status === types_1.PatientStatus.ADMITTED).length;
        record.dischargedPatients = patients.filter(p => p.status === types_1.PatientStatus.DISCHARGED).length;
        record.transferredPatients = patients.filter(p => p.status === types_1.PatientStatus.TRANSFERRED).length;
        record.totalWorkOrders = workOrders.length;
        record.pendingCleaning = workOrders.filter(wo => wo.status === types_1.CleaningStatus.PENDING).length;
        record.inProgressCleaning = workOrders.filter(wo => wo.status === types_1.CleaningStatus.IN_PROGRESS).length;
        record.completedCleaning = workOrders.filter(wo => wo.status === types_1.CleaningStatus.COMPLETED).length;
        record.overdueCleaning = workOrders.filter(wo => wo.status === types_1.CleaningStatus.OVERDUE).length;
    }
    checkStatusMismatch(beds, patients) {
        const discrepancies = [];
        beds.forEach(bed => {
            const patient = patients.find(p => bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId));
            if (bed.status === types_1.BedStatus.OCCUPIED && !patient && bed.currentPatientId) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.STATUS_MISMATCH, 'high', bed, undefined, undefined, '床位状态不一致', `床位 ${bed.bedNumber} 标记为占用状态，但未找到患者 ${bed.currentPatientId} 的流转记录。可能患者数据缺失或床位表错误`, { bedStatus: bed.status }));
            }
            if (bed.status === types_1.BedStatus.OCCUPIED && patient && patient.status !== types_1.PatientStatus.ADMITTED) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.STATUS_MISMATCH, 'critical', bed, patient, undefined, '床位与患者状态不一致', `床位 ${bed.bedNumber} 标记为占用，但患者 ${patient.name} (${patient.medicalRecordNumber}) 状态为 ${patient.status}（应为 admitted）`, { bedStatus: bed.status, patientStatus: patient.status }));
            }
            if (bed.status === types_1.BedStatus.VACANT) {
                const patientInBed = patients.find(p => p.currentBedId === bed.id || p.currentBedId === bed.bedNumber);
                if (patientInBed && patientInBed.status === types_1.PatientStatus.ADMITTED) {
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.STATUS_MISMATCH, 'high', bed, patientInBed, undefined, '床位与患者状态不一致', `床位 ${bed.bedNumber} 标记为空床，但患者 ${patientInBed.name} 状态为住院中。可能患者转出记录缺失`, { bedStatus: bed.status, patientStatus: patientInBed.status }));
                }
            }
        });
        return discrepancies;
    }
    checkDuplicateOccupancy(patients) {
        const discrepancies = [];
        const bedPatientMap = new Map();
        patients.filter(p => p.currentBedId && p.status === types_1.PatientStatus.ADMITTED)
            .forEach(patient => {
            if (patient.currentBedId) {
                const existing = bedPatientMap.get(patient.currentBedId) || [];
                existing.push(patient);
                bedPatientMap.set(patient.currentBedId, existing);
            }
        });
        bedPatientMap.forEach((patientList) => {
            if (patientList.length > 1) {
                const bed = DataStore_1.dataStore.getBed(patientList[0].currentBedId);
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.DUPLICATE_OCCUPANCY, 'critical', bed, patientList[0], undefined, '重复占用床位', `床位 ${bed?.bedNumber || 'unknown'} 被 ${patientList.length} 名患者同时占用: ${patientList.map(p => p.name).join(', ')}`, { bedStatus: bed?.status }));
            }
        });
        return discrepancies;
    }
    checkTransferLockBed(beds, patients) {
        const discrepancies = [];
        beds.forEach(bed => {
            if (bed.status === types_1.BedStatus.TRANSFER || bed.isLocked) {
                const patient = patients.find(p => bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId));
                if (patient && patient.status !== types_1.PatientStatus.TRANSFERRED) {
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.TRANSFER_LOCK_BED, 'high', bed, patient, undefined, '转科锁床状态不一致', `床位 ${bed.bedNumber} 标记为转科/锁定状态，但患者 ${patient.name} (${patient.medicalRecordNumber}) 状态为 ${patient.status}。可能转科记录未同步`, { bedStatus: bed.status, patientStatus: patient.status }));
                }
                if (!patient && bed.status === types_1.BedStatus.TRANSFER && bed.currentPatientId) {
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.TRANSFER_LOCK_BED, 'medium', bed, undefined, undefined, '转科锁床无关联患者', `床位 ${bed.bedNumber} 标记为转科状态，关联患者 ${bed.currentPatientId} 不存在。可能转科已完成但床位未解锁`, { bedStatus: bed.status }));
                }
            }
            if (bed.status === types_1.BedStatus.TRANSFER && !bed.isLocked) {
                const patient = patients.find(p => bed.currentPatientId && (p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId));
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.TRANSFER_LOCK_BED, 'medium', bed, patient, undefined, '转科床位未锁定', `床位 ${bed.bedNumber} 标记为转科状态但未锁定，可能存在状态不一致`, { bedStatus: bed.status }));
            }
        });
        return discrepancies;
    }
    checkCleaningTimeout(workOrders) {
        const discrepancies = [];
        const now = (0, moment_1.default)();
        workOrders.forEach(wo => {
            if (wo.status === types_1.CleaningStatus.IN_PROGRESS || wo.status === types_1.CleaningStatus.PENDING) {
                const startTime = (0, moment_1.default)(wo.startedAt || wo.requestedAt);
                const duration = now.diff(startTime, 'minutes');
                if (duration > this.CLEANING_TIMEOUT_MINUTES) {
                    const bed = DataStore_1.dataStore.getAllBeds().find(b => b.id === wo.bedId || b.bedNumber === wo.bedNumber);
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.CLEANING_TIMEOUT, 'high', bed, undefined, wo, '清洁超时', `床位 ${wo.bedNumber} 清洁工作已超时 ${Math.round(duration - this.CLEANING_TIMEOUT_MINUTES)} 分钟。申请时间: ${(0, moment_1.default)(wo.requestedAt).format('YYYY-MM-DD HH:mm')}`, { cleaningStatus: wo.status }));
                    DataStore_1.dataStore.updateWorkOrder(wo.id, { status: types_1.CleaningStatus.OVERDUE });
                }
            }
        });
        return discrepancies;
    }
    checkPatientsInCleaning(beds, workOrders) {
        const discrepancies = [];
        beds.forEach(bed => {
            if (bed.status === types_1.BedStatus.CLEANING) {
                const patient = DataStore_1.dataStore.getAllPatients().find(p => p.currentBedId === bed.id || p.currentBedId === bed.bedNumber);
                if (patient && patient.status === types_1.PatientStatus.ADMITTED) {
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.BED_NOT_CLEANED, 'critical', bed, patient, undefined, '清洁中床位仍有患者', `床位 ${bed.bedNumber} 标记为清洁中，但患者 ${patient.name} (${patient.medicalRecordNumber}) 仍在该床位且状态为住院中`, { bedStatus: bed.status, patientStatus: patient.status }));
                }
                const recentWorkOrder = workOrders.find(wo => (wo.bedId === bed.id || wo.bedNumber === bed.bedNumber) &&
                    (wo.status === types_1.CleaningStatus.IN_PROGRESS || wo.status === types_1.CleaningStatus.PENDING));
                if (!recentWorkOrder) {
                    discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.BED_NOT_CLEANED, 'medium', bed, undefined, undefined, '床位标记为清洁中但无工单', `床位 ${bed.bedNumber} 标记为清洁状态，但没有对应的清洁工单`, { bedStatus: bed.status }));
                }
            }
        });
        return discrepancies;
    }
    checkDataConsistency(beds, patients, workOrders) {
        const discrepancies = [];
        const bedIdSet = new Set(beds.map(b => b.id));
        const bedNumberSet = new Set(beds.map(b => b.bedNumber));
        const patientIdSet = new Set(patients.map(p => p.id));
        const patientMRNSet = new Set(patients.map(p => p.medicalRecordNumber));
        patients.filter(p => p.currentBedId).forEach(patient => {
            const bedId = patient.currentBedId;
            if (!bedIdSet.has(bedId) && !bedNumberSet.has(bedId)) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.DATA_INCONSISTENCY, 'high', undefined, patient, undefined, '患者引用不存在床位', `患者 ${patient.name} (${patient.medicalRecordNumber}) 引用了不存在的床位: ${bedId}`, { patientStatus: patient.status }));
            }
        });
        beds.filter(b => b.currentPatientId).forEach(bed => {
            const patientId = bed.currentPatientId;
            if (!patientIdSet.has(patientId) && !patientMRNSet.has(patientId)) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.DATA_INCONSISTENCY, 'high', bed, undefined, undefined, '床位引用不存在患者', `床位 ${bed.bedNumber} 引用了不存在的患者: ${patientId}`, { bedStatus: bed.status }));
            }
        });
        workOrders.forEach(wo => {
            const bedId = wo.bedId;
            if (!bedIdSet.has(bedId) && !bedNumberSet.has(bedId)) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.DATA_INCONSISTENCY, 'medium', undefined, undefined, wo, '清洁工单引用不存在床位', `清洁工单引用了不存在的床位: ${bedId} (${wo.bedNumber})`, { cleaningStatus: wo.status }));
            }
        });
        return discrepancies;
    }
    createDiscrepancy(type, severity, bed, patient, workOrder, description, detailedExplanation, sourceData) {
        return {
            id: (0, uuid_1.v4)(),
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
    getAffectedFields(type) {
        switch (type) {
            case types_1.DiscrepancyType.STATUS_MISMATCH:
                return ['bed.status', 'patient.status', 'bed.currentPatientId'];
            case types_1.DiscrepancyType.DUPLICATE_OCCUPANCY:
                return ['patient.currentBedId', 'bed.currentPatientId'];
            case types_1.DiscrepancyType.TRANSFER_LOCK_BED:
                return ['bed.status', 'bed.isLocked', 'patient.status'];
            case types_1.DiscrepancyType.CLEANING_TIMEOUT:
                return ['workOrder.status', 'workOrder.startedAt'];
            case types_1.DiscrepancyType.MISSING_PATIENT:
                return ['bed.currentPatientId', 'patient.status'];
            case types_1.DiscrepancyType.EXTRA_PATIENT:
                return ['patient.currentBedId'];
            case types_1.DiscrepancyType.BED_NOT_CLEANED:
                return ['bed.status', 'workOrder.status'];
            case types_1.DiscrepancyType.DATA_INCONSISTENCY:
                return ['id', 'reference'];
            default:
                return ['unknown'];
        }
    }
    getDataSources(type) {
        switch (type) {
            case types_1.DiscrepancyType.STATUS_MISMATCH:
            case types_1.DiscrepancyType.DUPLICATE_OCCUPANCY:
            case types_1.DiscrepancyType.MISSING_PATIENT:
            case types_1.DiscrepancyType.EXTRA_PATIENT:
                return [types_1.DataSource.BED_CSV, types_1.DataSource.PATIENT_JSON];
            case types_1.DiscrepancyType.TRANSFER_LOCK_BED:
                return [types_1.DataSource.BED_CSV, types_1.DataSource.PATIENT_JSON];
            case types_1.DiscrepancyType.CLEANING_TIMEOUT:
            case types_1.DiscrepancyType.BED_NOT_CLEANED:
                return [types_1.DataSource.BED_CSV, types_1.DataSource.CLEANING_WORKORDER];
            case types_1.DiscrepancyType.DATA_INCONSISTENCY:
                return [types_1.DataSource.BED_CSV, types_1.DataSource.PATIENT_JSON, types_1.DataSource.CLEANING_WORKORDER];
            default:
                return [types_1.DataSource.BED_CSV];
        }
    }
    getPatientHistoryTrace(patientId) {
        const patient = DataStore_1.dataStore.getPatient(patientId);
        if (!patient) {
            return { patient: undefined, history: [], auditLogs: [], relatedDiscrepancies: [] };
        }
        const auditLogs = DataStore_1.dataStore.getAuditLogsByEntity('patient', patientId);
        const relatedDiscrepancies = DataStore_1.dataStore.getAllDiscrepancies().filter(d => d.patientId === patientId);
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
exports.ReconciliationEngine = ReconciliationEngine;
exports.reconciliationEngine = new ReconciliationEngine();
//# sourceMappingURL=ReconciliationEngine.js.map