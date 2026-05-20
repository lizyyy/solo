"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const DataStore_1 = require("../models/DataStore");
class ReviewService {
    async reviewDiscrepancy(discrepancyId, result, action, notes, reviewedBy, supportingEvidence) {
        const discrepancy = DataStore_1.dataStore.getDiscrepancy(discrepancyId);
        if (!discrepancy) {
            throw new Error(`Discrepancy ${discrepancyId} not found`);
        }
        const decision = {
            id: (0, uuid_1.v4)(),
            discrepancyId,
            result,
            action,
            decisionNotes: notes,
            supportingEvidence,
            requiresFollowUp: result === types_1.ReviewResult.NEEDS_MORE_INFO,
            madeBy: reviewedBy,
            madeAt: new Date()
        };
        DataStore_1.dataStore.addReviewDecision(decision);
        const updatedDiscrepancy = await this.applyResolutionAction(discrepancy, action, result, reviewedBy);
        DataStore_1.dataStore.addAuditLog({
            action: 'discrepancy_reviewed',
            entityType: 'discrepancy',
            entityId: discrepancyId,
            previousValue: { status: discrepancy.reviewStatus, isResolved: discrepancy.isResolved },
            newValue: { status: result, isResolved: result === types_1.ReviewResult.APPROVED || result === types_1.ReviewResult.MANUALLY_RESOLVED },
            performedBy: reviewedBy,
            notes: `Review: ${result}, Action: ${action}, Notes: ${notes}`,
            source: types_1.DataSource.MANUAL_REVIEW
        });
        return {
            success: true,
            decision,
            updatedDiscrepancy
        };
    }
    async applyResolutionAction(discrepancy, action, result, reviewedBy) {
        const isResolved = result === types_1.ReviewResult.APPROVED || result === types_1.ReviewResult.MANUALLY_RESOLVED;
        const updates = {
            reviewStatus: result,
            reviewedBy,
            reviewedAt: new Date(),
            isResolved
        };
        if (isResolved) {
            updates.resolvedAt = new Date();
            updates.resolvedBy = reviewedBy;
            updates.resolutionNotes = `Resolved via ${action}`;
        }
        if (discrepancy.bedId) {
            await this.applyBedAction(discrepancy.bedId, action, reviewedBy);
        }
        if (discrepancy.patientId) {
            await this.applyPatientAction(discrepancy.patientId, action, reviewedBy);
        }
        if (discrepancy.workOrderId) {
            await this.applyWorkOrderAction(discrepancy.workOrderId, action, reviewedBy);
        }
        return DataStore_1.dataStore.updateDiscrepancy(discrepancy.id, updates);
    }
    async applyBedAction(bedId, action, performedBy) {
        const bed = DataStore_1.dataStore.getBed(bedId);
        if (!bed)
            return;
        switch (action) {
            case types_1.ReviewAction.RELEASE:
                DataStore_1.dataStore.updateBed(bedId, { isLocked: false, status: types_1.BedStatus.VACANT });
                DataStore_1.dataStore.addAuditLog({
                    action: 'bed_released',
                    entityType: 'bed',
                    entityId: bedId,
                    previousValue: { isLocked: bed.isLocked, status: bed.status },
                    newValue: { isLocked: false, status: types_1.BedStatus.VACANT },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
            case types_1.ReviewAction.LOCK:
                DataStore_1.dataStore.updateBed(bedId, { isLocked: true, status: types_1.BedStatus.LOCKED });
                DataStore_1.dataStore.addAuditLog({
                    action: 'bed_locked',
                    entityType: 'bed',
                    entityId: bedId,
                    previousValue: { isLocked: bed.isLocked, status: bed.status },
                    newValue: { isLocked: true, status: types_1.BedStatus.LOCKED },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
            case types_1.ReviewAction.UPDATE_STATUS:
                DataStore_1.dataStore.updateBed(bedId, { status: types_1.BedStatus.VACANT });
                DataStore_1.dataStore.addAuditLog({
                    action: 'bed_status_updated',
                    entityType: 'bed',
                    entityId: bedId,
                    previousValue: { status: bed.status },
                    newValue: { status: types_1.BedStatus.VACANT },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
            case types_1.ReviewAction.MARK_CLEANED:
                DataStore_1.dataStore.updateBed(bedId, { status: types_1.BedStatus.VACANT, lastCleanedAt: new Date() });
                DataStore_1.dataStore.addAuditLog({
                    action: 'bed_marked_cleaned',
                    entityType: 'bed',
                    entityId: bedId,
                    previousValue: { status: bed.status, lastCleanedAt: bed.lastCleanedAt },
                    newValue: { status: types_1.BedStatus.VACANT, lastCleanedAt: new Date() },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
            case types_1.ReviewAction.REMOVE_PATIENT:
                DataStore_1.dataStore.updateBed(bedId, { currentPatientId: undefined, status: types_1.BedStatus.VACANT });
                DataStore_1.dataStore.addAuditLog({
                    action: 'patient_removed_from_bed',
                    entityType: 'bed',
                    entityId: bedId,
                    previousValue: { currentPatientId: bed.currentPatientId, status: bed.status },
                    newValue: { currentPatientId: undefined, status: types_1.BedStatus.VACANT },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
        }
    }
    async applyPatientAction(patientId, action, performedBy) {
        const patient = DataStore_1.dataStore.getPatient(patientId);
        if (!patient)
            return;
        switch (action) {
            case types_1.ReviewAction.REMOVE_PATIENT:
                DataStore_1.dataStore.updatePatient(patientId, { currentBedId: undefined, status: types_1.PatientStatus.DISCHARGED });
                DataStore_1.dataStore.addAuditLog({
                    action: 'patient_discharged',
                    entityType: 'patient',
                    entityId: patientId,
                    previousValue: { currentBedId: patient.currentBedId, status: patient.status },
                    newValue: { currentBedId: undefined, status: types_1.PatientStatus.DISCHARGED },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
            case types_1.ReviewAction.UPDATE_STATUS:
                DataStore_1.dataStore.updatePatient(patientId, { status: types_1.PatientStatus.TRANSFERRED });
                DataStore_1.dataStore.addAuditLog({
                    action: 'patient_status_updated',
                    entityType: 'patient',
                    entityId: patientId,
                    previousValue: { status: patient.status },
                    newValue: { status: types_1.PatientStatus.TRANSFERRED },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
        }
    }
    async applyWorkOrderAction(workOrderId, action, performedBy) {
        const workOrder = DataStore_1.dataStore.getWorkOrder(workOrderId);
        if (!workOrder)
            return;
        switch (action) {
            case types_1.ReviewAction.MARK_CLEANED:
                DataStore_1.dataStore.updateWorkOrder(workOrderId, {
                    status: types_1.CleaningStatus.COMPLETED,
                    completedAt: new Date()
                });
                DataStore_1.dataStore.addAuditLog({
                    action: 'workorder_completed',
                    entityType: 'workorder',
                    entityId: workOrderId,
                    previousValue: { status: workOrder.status, completedAt: workOrder.completedAt },
                    newValue: { status: types_1.CleaningStatus.COMPLETED, completedAt: new Date() },
                    performedBy,
                    source: types_1.DataSource.MANUAL_REVIEW
                });
                break;
        }
    }
    getDiscrepancyReviewHistory(discrepancyId) {
        const discrepancy = DataStore_1.dataStore.getDiscrepancy(discrepancyId);
        const decisions = DataStore_1.dataStore.getReviewDecisionsByDiscrepancy(discrepancyId);
        const auditLogs = DataStore_1.dataStore.getAuditLogsByEntity('discrepancy', discrepancyId);
        return {
            discrepancy,
            decisions,
            auditLogs
        };
    }
    getPendingReviews() {
        return DataStore_1.dataStore.getAllDiscrepancies().filter(d => !d.isResolved);
    }
    getReviewedDiscrepancies() {
        return DataStore_1.dataStore.getAllDiscrepancies().filter(d => d.isResolved);
    }
    async batchReview(discrepancyIds, result, action, notes, reviewedBy) {
        const results = [];
        for (const discrepancyId of discrepancyIds) {
            try {
                await this.reviewDiscrepancy(discrepancyId, result, action, notes, reviewedBy);
                results.push({ discrepancyId, success: true });
            }
            catch (error) {
                results.push({
                    discrepancyId,
                    success: false,
                    error: error.message
                });
            }
        }
        return {
            success: results.every(r => r.success),
            results
        };
    }
    getPatientAuditTrail(patientId) {
        const patient = DataStore_1.dataStore.getPatient(patientId);
        if (!patient) {
            return { patientInfo: null, history: [], auditLogs: [], relatedDiscrepancies: [] };
        }
        const auditLogs = DataStore_1.dataStore.getAuditLogsByEntity('patient', patientId);
        const relatedDiscrepancies = DataStore_1.dataStore.getAllDiscrepancies().filter(d => d.patientId === patientId);
        return {
            patientInfo: {
                id: patient.id,
                name: patient.name,
                medicalRecordNumber: patient.medicalRecordNumber,
                currentStatus: patient.status,
                currentBedId: patient.currentBedId,
                admissionDate: patient.admissionDate,
                outcome: patient.outcome
            },
            history: patient.history,
            auditLogs,
            relatedDiscrepancies
        };
    }
    generateDiscrepancyExplanation(discrepancyId) {
        const discrepancy = DataStore_1.dataStore.getDiscrepancy(discrepancyId);
        if (!discrepancy) {
            throw new Error(`Discrepancy ${discrepancyId} not found`);
        }
        const { decisions, auditLogs } = this.getDiscrepancyReviewHistory(discrepancyId);
        const rootCauseMap = {
            status_mismatch: '床位状态与患者状态不同步，可能由于患者转科/出院记录缺失或床位更新延迟',
            duplicate_occupancy: '多名患者同时分配到同一床位，可能由于床位分配系统并发问题或人工操作错误',
            transfer_lock_bed: '转科锁床状态与患者实际状态不一致，可能由于转科流程未完成或锁床未及时释放',
            cleaning_timeout: '清洁工作未在规定时间内完成，可能由于清洁人员不足或工单未及时更新',
            missing_patient: '床位标记为占用但无对应患者记录，可能由于患者入科记录缺失',
            extra_patient: '患者有床位分配但床位状态为空床，可能由于患者出科记录缺失',
            bed_not_cleaned: '清洁状态与实际不符，可能由于清洁完成未及时登记或工单丢失',
            data_inconsistency: '数据引用不一致，可能由于ID生成或数据同步问题'
        };
        const recommendationsMap = {
            status_mismatch: [
                '核对患者流转记录，确认入科/出科时间',
                '更新床位状态与患者实际状态保持一致',
                '建立状态同步检查机制'
            ],
            duplicate_occupancy: [
                '确认每位患者的实际床位分配',
                '纠正错误的床位分配记录',
                '优化床位分配系统防并发机制'
            ],
            transfer_lock_bed: [
                '核实转科流程是否完成',
                '根据实际情况释放或保持床位锁定',
                '完善转科后床位自动解锁机制'
            ],
            cleaning_timeout: [
                '联系清洁班组确认进度',
                '根据实际情况更新工单号状态',
                '分析超时原因优化清洁流程'
            ],
            bed_not_cleaned: [
                '核实床位实际清洁状态',
                '补登缺失的清洁工单',
                '建立清洁完成的即时反馈机制'
            ]
        };
        return {
            summary: discrepancy.description,
            detailedExplanation: discrepancy.detailedExplanation,
            rootCause: rootCauseMap[discrepancy.type] || '待进一步分析',
            recommendedActions: recommendationsMap[discrepancy.type] || ['请根据实际情况采取相应措施'],
            supportingEvidence: [
                { type: 'discrepancy_data', data: discrepancy.sourceData },
                { type: 'review_decisions', data: decisions },
                { type: 'audit_logs', data: auditLogs.slice(0, 10) }
            ]
        };
    }
}
exports.ReviewService = ReviewService;
exports.reviewService = new ReviewService();
//# sourceMappingURL=ReviewService.js.map