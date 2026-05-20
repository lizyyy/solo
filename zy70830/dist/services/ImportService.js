"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importService = exports.ImportService = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
const DataStore_1 = require("../models/DataStore");
class ImportService {
    async importBedCSV(filePath) {
        const results = [];
        const errors = [];
        const warnings = [];
        let rowNumber = 0;
        return new Promise((resolve) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rowNumber++;
                try {
                    const bed = this.parseBedRow(row, rowNumber);
                    if (bed) {
                        results.push(bed);
                    }
                }
                catch (error) {
                    errors.push(`Row ${rowNumber}: ${error.message}`);
                }
            })
                .on('end', () => {
                results.forEach(bed => DataStore_1.dataStore.addBed(bed));
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
    parseBedRow(row, rowNumber) {
        const requiredFields = ['bedNumber', 'ward', 'room', 'status'];
        const missingFields = requiredFields.filter(field => !row[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        const statusMap = {
            'occupied': types_1.BedStatus.OCCUPIED,
            'vacant': types_1.BedStatus.VACANT,
            'cleaning': types_1.BedStatus.CLEANING,
            'locked': types_1.BedStatus.LOCKED,
            'transfer': types_1.BedStatus.TRANSFER
        };
        const status = statusMap[row.status.toLowerCase()];
        if (!status) {
            throw new Error(`Invalid bed status: ${row.status}`);
        }
        const cleaningStatusMap = {
            'pending': types_1.CleaningStatus.PENDING,
            'in_progress': types_1.CleaningStatus.IN_PROGRESS,
            'completed': types_1.CleaningStatus.COMPLETED,
            'overdue': types_1.CleaningStatus.OVERDUE
        };
        return {
            id: row.bedNumber.trim(),
            bedNumber: row.bedNumber.trim(),
            ward: row.ward.trim(),
            room: row.room.trim(),
            status,
            currentPatientId: row.patientId?.trim() || undefined,
            isLocked: row.isLocked?.toLowerCase() === 'true' || status === types_1.BedStatus.LOCKED,
            lockReason: row.lockReason?.trim() || undefined,
            lockedBy: row.lockedBy?.trim() || undefined,
            lockedAt: row.lockedAt ? new Date(row.lockedAt) : undefined,
            lastCleanedAt: row.lastCleanedAt ? new Date(row.lastCleanedAt) : undefined,
            cleaningStatus: row.cleaningStatus ? cleaningStatusMap[row.cleaningStatus.toLowerCase()] : undefined,
            assignedNurse: row.assignedNurse?.trim() || undefined,
            notes: row.notes?.trim() || undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            source: types_1.DataSource.BED_CSV
        };
    }
    async importPatientJSON(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const patientsData = Array.isArray(data) ? data : data.patients || [data];
            const results = [];
            const errors = [];
            const warnings = [];
            for (let i = 0; i < patientsData.length; i++) {
                try {
                    const patient = this.parsePatientData(patientsData[i]);
                    results.push(patient);
                }
                catch (error) {
                    errors.push(`Patient ${i + 1}: ${error.message}`);
                }
            }
            results.forEach(patient => DataStore_1.dataStore.addPatient(patient));
            return {
                success: errors.length === 0,
                totalRecords: patientsData.length,
                importedRecords: results.length,
                failedRecords: errors.length,
                errors,
                warnings,
                data: results
            };
        }
        catch (error) {
            return {
                success: false,
                totalRecords: 0,
                importedRecords: 0,
                failedRecords: 1,
                errors: [`File read/parse error: ${error.message}`],
                warnings: [],
                data: []
            };
        }
    }
    parsePatientData(data) {
        const requiredFields = ['medicalRecordNumber', 'name', 'age', 'gender', 'diagnosis', 'status', 'admissionDate', 'attendingPhysician'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        const statusMap = {
            'admitted': types_1.PatientStatus.ADMITTED,
            'transferred': types_1.PatientStatus.TRANSFERRED,
            'discharged': types_1.PatientStatus.DISCHARGED
        };
        const status = statusMap[data.status.toLowerCase()];
        if (!status) {
            throw new Error(`Invalid patient status: ${data.status}`);
        }
        const outcomeMap = {
            'recovery_discharge': types_1.PatientOutcome.RECOVERY_DISCHARGE,
            'transfer_to_other_ward': types_1.PatientOutcome.TRANSFER_TO_OTHER_WARD,
            'transfer_to_icu': types_1.PatientOutcome.TRANSFER_TO_ICU,
            'death': types_1.PatientOutcome.DEATH,
            'autopsy': types_1.PatientOutcome.AUTOPSY,
            'other': types_1.PatientOutcome.OTHER
        };
        const normalizeBedId = (bedId) => {
            if (!bedId)
                return undefined;
            return bedId.replace(/^BED_/, '').trim();
        };
        const history = (data.history || []).map((h) => ({
            id: (0, uuid_1.v4)(),
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
            source: types_1.DataSource.PATIENT_JSON
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
            source: types_1.DataSource.PATIENT_JSON
        };
    }
    async importCleaningWorkOrdersJSON(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const workOrdersData = Array.isArray(data) ? data : data.workOrders || [data];
            const results = [];
            const errors = [];
            const warnings = [];
            for (let i = 0; i < workOrdersData.length; i++) {
                try {
                    const workOrder = this.parseCleaningWorkOrderData(workOrdersData[i]);
                    results.push(workOrder);
                }
                catch (error) {
                    errors.push(`WorkOrder ${i + 1}: ${error.message}`);
                }
            }
            results.forEach(wo => DataStore_1.dataStore.addWorkOrder(wo));
            return {
                success: errors.length === 0,
                totalRecords: workOrdersData.length,
                importedRecords: results.length,
                failedRecords: errors.length,
                errors,
                warnings,
                data: results
            };
        }
        catch (error) {
            return {
                success: false,
                totalRecords: 0,
                importedRecords: 0,
                failedRecords: 1,
                errors: [`File read/parse error: ${error.message}`],
                warnings: [],
                data: []
            };
        }
    }
    parseCleaningWorkOrderData(data) {
        const requiredFields = ['bedId', 'bedNumber', 'ward', 'requestedBy', 'requestedAt', 'status'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        const statusMap = {
            'pending': types_1.CleaningStatus.PENDING,
            'in_progress': types_1.CleaningStatus.IN_PROGRESS,
            'completed': types_1.CleaningStatus.COMPLETED,
            'overdue': types_1.CleaningStatus.OVERDUE
        };
        const status = statusMap[data.status.toLowerCase()];
        if (!status) {
            throw new Error(`Invalid cleaning status: ${data.status}`);
        }
        const normalizeBedId = (bedId) => {
            if (!bedId)
                return undefined;
            return bedId.replace(/^BED_/, '').trim();
        };
        const normalizePatientId = (patientId) => {
            if (!patientId || patientId === '')
                return undefined;
            return patientId.trim();
        };
        return {
            id: (0, uuid_1.v4)(),
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
            source: types_1.DataSource.CLEANING_WORKORDER
        };
    }
    validateBedPatientConsistency() {
        const beds = DataStore_1.dataStore.getAllBeds();
        const patients = DataStore_1.dataStore.getAllPatients();
        const workOrders = DataStore_1.dataStore.getAllWorkOrders();
        const issues = [];
        beds.forEach(bed => {
            if (bed.currentPatientId && bed.status === types_1.BedStatus.VACANT) {
                issues.push(`床位 ${bed.bedNumber} 标记为空床但有关联患者 ${bed.currentPatientId}`);
            }
            if (bed.currentPatientId) {
                const patient = patients.find(p => p.id === bed.currentPatientId || p.medicalRecordNumber === bed.currentPatientId);
                if (!patient) {
                    issues.push(`床位 ${bed.bedNumber} 引用不存在的患者 ${bed.currentPatientId}`);
                }
                else if (patient.currentBedId !== bed.id && patient.currentBedId !== bed.bedNumber) {
                    issues.push(`患者 ${patient.name} 不在床位 ${bed.bedNumber} 上，但床位引用了该患者`);
                }
            }
        });
        patients.forEach(patient => {
            if (patient.currentBedId) {
                const bed = beds.find(b => b.id === patient.currentBedId || b.bedNumber === patient.currentBedId);
                if (!bed) {
                    issues.push(`患者 ${patient.name} (${patient.medicalRecordNumber}) 引用不存在的床位 ${patient.currentBedId}`);
                }
                else if (bed.currentPatientId !== patient.id && bed.currentPatientId !== patient.medicalRecordNumber) {
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
exports.ImportService = ImportService;
exports.importService = new ImportService();
//# sourceMappingURL=ImportService.js.map