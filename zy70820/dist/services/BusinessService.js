"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessService = exports.BusinessService = void 0;
const DataStore_1 = require("../store/DataStore");
const types_1 = require("../types");
class BusinessService {
    validateVaccinationInterval(childId, vaccineCode, appointmentDate) {
        const child = DataStore_1.dataStore.getChildProfileById(childId);
        if (!child) {
            return { valid: true };
        }
        const lastVaccination = child.vaccineHistory
            .filter(v => v.vaccineCode === vaccineCode)
            .sort((a, b) => new Date(b.vaccinationDate).getTime() - new Date(a.vaccinationDate).getTime())[0];
        if (lastVaccination) {
            const inventory = DataStore_1.dataStore.getVaccineInventories().find(v => v.vaccineCode === vaccineCode);
            const intervalDays = inventory?.intervalDays || 30;
            const lastDate = new Date(lastVaccination.vaccinationDate);
            const apptDate = new Date(appointmentDate);
            const diffDays = Math.floor((apptDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < intervalDays) {
                return {
                    valid: false,
                    reason: `与上一次接种间隔不足 ${intervalDays} 天，当前间隔 ${diffDays} 天`
                };
            }
        }
        return { valid: true };
    }
    validateAge(childId, vaccineCode) {
        const child = DataStore_1.dataStore.getChildProfileById(childId);
        if (!child) {
            return { valid: true };
        }
        const birthDate = new Date(child.birthDate);
        const now = new Date();
        const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
        const inventory = DataStore_1.dataStore.getVaccineInventories().find(v => v.vaccineCode === vaccineCode);
        const minimumAgeMonths = inventory?.minimumAgeMonths || 0;
        if (ageMonths < minimumAgeMonths) {
            return {
                valid: false,
                reason: `年龄不足，最小接种月龄为 ${minimumAgeMonths} 个月，当前 ${ageMonths} 个月`
            };
        }
        return { valid: true };
    }
    checkContraindications(childId, vaccineCode) {
        const rules = DataStore_1.dataStore.getContraindicationRulesByVaccineCode(vaccineCode);
        const reasons = [];
        for (const rule of rules) {
            if (rule.severity === 'high') {
                reasons.push(`禁忌规则: ${rule.description}`);
            }
        }
        return {
            blocked: reasons.length > 0,
            reasons
        };
    }
    checkDuplicateAppointment(childId, vaccineCode, batchId) {
        const existingRecords = DataStore_1.dataStore.getAppointmentRecordsByChildId(childId);
        const duplicate = existingRecords.some(r => r.vaccineCode === vaccineCode &&
            r.batchId === batchId &&
            r.status !== types_1.RecordStatus.REJECTED);
        if (duplicate) {
            return {
                duplicate: true,
                reason: '该儿童在本批次中已有预约记录'
            };
        }
        return { duplicate: false };
    }
    processAppointmentRecord(recordId, operator) {
        const record = DataStore_1.dataStore.getAppointmentRecordById(recordId);
        if (!record) {
            return { success: false, reason: '记录不存在' };
        }
        if (record.status !== types_1.RecordStatus.PENDING && record.status !== types_1.RecordStatus.RETURNED) {
            return { success: false, reason: '当前状态不允许处理' };
        }
        const previousStatus = record.status;
        const contraindicationCheck = this.checkContraindications(record.childId, record.vaccineCode);
        if (contraindicationCheck.blocked) {
            DataStore_1.dataStore.updateAppointmentRecord(recordId, {
                status: types_1.RecordStatus.REJECTED,
                blockReason: contraindicationCheck.reasons.join('; '),
                processedBy: operator,
                processedAt: new Date().toISOString()
            });
            DataStore_1.dataStore.addOperationLog(recordId, {
                operationType: types_1.OperationType.CONTRAINDICATION_BLOCK,
                operator,
                reason: contraindicationCheck.reasons.join('; '),
                previousStatus,
                newStatus: types_1.RecordStatus.REJECTED
            });
            return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
        }
        const duplicateCheck = this.checkDuplicateAppointment(record.childId, record.vaccineCode, record.batchId);
        if (duplicateCheck.duplicate) {
            DataStore_1.dataStore.updateAppointmentRecord(recordId, {
                status: types_1.RecordStatus.REJECTED,
                blockReason: duplicateCheck.reason,
                processedBy: operator,
                processedAt: new Date().toISOString()
            });
            DataStore_1.dataStore.addOperationLog(recordId, {
                operationType: types_1.OperationType.DUPLICATE_BLOCK,
                operator,
                reason: duplicateCheck.reason,
                previousStatus,
                newStatus: types_1.RecordStatus.REJECTED
            });
            return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
        }
        const intervalCheck = this.validateVaccinationInterval(record.childId, record.vaccineCode, record.appointmentDate);
        if (!intervalCheck.valid) {
            DataStore_1.dataStore.updateAppointmentRecord(recordId, {
                status: types_1.RecordStatus.RETURNED,
                blockReason: intervalCheck.reason,
                processedBy: operator,
                processedAt: new Date().toISOString()
            });
            DataStore_1.dataStore.addOperationLog(recordId, {
                operationType: types_1.OperationType.RETURN,
                operator,
                reason: intervalCheck.reason,
                previousStatus,
                newStatus: types_1.RecordStatus.RETURNED
            });
            return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
        }
        const ageCheck = this.validateAge(record.childId, record.vaccineCode);
        if (!ageCheck.valid) {
            DataStore_1.dataStore.updateAppointmentRecord(recordId, {
                status: types_1.RecordStatus.RETURNED,
                blockReason: ageCheck.reason,
                processedBy: operator,
                processedAt: new Date().toISOString()
            });
            DataStore_1.dataStore.addOperationLog(recordId, {
                operationType: types_1.OperationType.RETURN,
                operator,
                reason: ageCheck.reason,
                previousStatus,
                newStatus: types_1.RecordStatus.RETURNED
            });
            return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
        }
        const inventory = DataStore_1.dataStore.getVaccineInventoryByCode(record.vaccineCode);
        if (!inventory || inventory.availableQuantity <= 0) {
            const waitlistOrder = DataStore_1.dataStore.getNextWaitlistOrder(record.batchId);
            DataStore_1.dataStore.updateAppointmentRecord(recordId, {
                status: types_1.RecordStatus.WAITLISTED,
                waitlistOrder,
                waitlistSource: '疫苗库存不足',
                processedBy: operator,
                processedAt: new Date().toISOString()
            });
            DataStore_1.dataStore.addOperationLog(recordId, {
                operationType: types_1.OperationType.WAITLIST,
                operator,
                reason: `疫苗库存不足，候补顺序: ${waitlistOrder}`,
                previousStatus,
                newStatus: types_1.RecordStatus.WAITLISTED
            });
            return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
        }
        DataStore_1.dataStore.updateVaccineInventory(inventory.id, {
            availableQuantity: inventory.availableQuantity - 1
        });
        DataStore_1.dataStore.updateAppointmentRecord(recordId, {
            status: types_1.RecordStatus.APPROVED,
            processedBy: operator,
            processedAt: new Date().toISOString()
        });
        DataStore_1.dataStore.addOperationLog(recordId, {
            operationType: types_1.OperationType.APPROVE,
            operator,
            reason: '审核通过',
            previousStatus,
            newStatus: types_1.RecordStatus.APPROVED
        });
        const batch = DataStore_1.dataStore.getBatchById(record.batchId);
        if (batch) {
            DataStore_1.dataStore.updateBatch(record.batchId, {
                processedCount: batch.processedCount + 1
            });
        }
        return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
    }
    returnToPending(recordId, operator, reason) {
        const record = DataStore_1.dataStore.getAppointmentRecordById(recordId);
        if (!record) {
            return { success: false };
        }
        const previousStatus = record.status;
        DataStore_1.dataStore.updateAppointmentRecord(recordId, {
            status: types_1.RecordStatus.PENDING,
            notes: reason
        });
        DataStore_1.dataStore.addOperationLog(recordId, {
            operationType: types_1.OperationType.RETURN,
            operator,
            reason: `退回待处理: ${reason}`,
            previousStatus,
            newStatus: types_1.RecordStatus.PENDING
        });
        return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
    }
    markAsProcessed(recordId, operator) {
        const record = DataStore_1.dataStore.getAppointmentRecordById(recordId);
        if (!record) {
            return { success: false };
        }
        if (record.status !== types_1.RecordStatus.APPROVED) {
            return { success: false };
        }
        const previousStatus = record.status;
        DataStore_1.dataStore.updateAppointmentRecord(recordId, {
            status: types_1.RecordStatus.PROCESSED,
            processedBy: operator,
            processedAt: new Date().toISOString()
        });
        DataStore_1.dataStore.addOperationLog(recordId, {
            operationType: types_1.OperationType.MARK_PROCESSED,
            operator,
            reason: '完成接种',
            previousStatus,
            newStatus: types_1.RecordStatus.PROCESSED
        });
        return { success: true, record: DataStore_1.dataStore.getAppointmentRecordById(recordId) };
    }
    processBatchRecords(batchId, operator) {
        const records = DataStore_1.dataStore.getAppointmentRecordsByBatchId(batchId);
        let processed = 0;
        let failed = 0;
        for (const record of records) {
            if (record.status === types_1.RecordStatus.PENDING || record.status === types_1.RecordStatus.RETURNED) {
                const result = this.processAppointmentRecord(record.id, operator);
                if (result.success) {
                    processed++;
                }
                else {
                    failed++;
                }
            }
        }
        return {
            total: records.length,
            processed,
            failed
        };
    }
    getWaitlistTraceability(batchId) {
        const records = DataStore_1.dataStore.getAppointmentRecordsByBatchId(batchId)
            .filter(r => r.status === types_1.RecordStatus.WAITLISTED)
            .sort((a, b) => (a.waitlistOrder || 0) - (b.waitlistOrder || 0));
        return records.map(r => ({
            recordId: r.id,
            childName: r.childName,
            waitlistOrder: r.waitlistOrder || 0,
            waitlistSource: r.waitlistSource,
            operationLogs: r.operationLogs.map(log => ({
                timestamp: log.timestamp,
                operator: log.operator,
                reason: log.reason
            }))
        }));
    }
}
exports.BusinessService = BusinessService;
exports.businessService = new BusinessService();
