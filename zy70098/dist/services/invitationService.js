"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const stateMachine_1 = require("../core/stateMachine");
const deviationCalculator_1 = require("../core/deviationCalculator");
const settlementCalculator_1 = require("../core/settlementCalculator");
const eventReplay_1 = require("../core/eventReplay");
class InvitationService {
    constructor(db) {
        this.db = db;
    }
    createBatch(input, operator) {
        if (input.targetPeakLoad <= 0) {
            return {
                success: false,
                error: {
                    code: 'INVALID_TARGET_PEAK_LOAD',
                    message: '目标削峰容量必须大于 0',
                    details: { targetPeakLoad: input.targetPeakLoad }
                }
            };
        }
        if (input.unitPrice <= 0) {
            return {
                success: false,
                error: {
                    code: 'INVALID_UNIT_PRICE',
                    message: '单位补贴价格必须大于 0',
                    details: { unitPrice: input.unitPrice }
                }
            };
        }
        if (input.enrollmentEndTime <= input.enrollmentStartTime) {
            return {
                success: false,
                error: {
                    code: 'INVALID_ENROLLMENT_TIME',
                    message: '报名结束时间必须晚于报名开始时间',
                    details: {
                        enrollmentStartTime: input.enrollmentStartTime,
                        enrollmentEndTime: input.enrollmentEndTime
                    }
                }
            };
        }
        if (input.executionEndTime <= input.executionStartTime) {
            return {
                success: false,
                error: {
                    code: 'INVALID_EXECUTION_TIME',
                    message: '执行结束时间必须晚于执行开始时间',
                    details: {
                        executionStartTime: input.executionStartTime,
                        executionEndTime: input.executionEndTime
                    }
                }
            };
        }
        const now = new Date();
        const batch = {
            id: (0, uuid_1.v4)(),
            ...input,
            status: types_1.InvitationBatchStatus.DRAFT,
            createdAt: now,
            updatedAt: now,
            version: 1
        };
        const saved = this.db.saveBatch(batch);
        const event = (0, stateMachine_1.createEventRecord)('batch', 'create', { entityId: saved.id, operator }, undefined, types_1.InvitationBatchStatus.DRAFT, { ...input });
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    publishBatch(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.PUBLISHED, 'publish', operator);
    }
    startEnrollment(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.ENROLLMENT_STARTED, 'start_enrollment', operator);
    }
    closeEnrollment(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.ENROLLMENT_CLOSED, 'close_enrollment', operator);
    }
    startExecution(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.EXECUTION_STARTED, 'start_execution', operator);
    }
    completeExecution(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.EXECUTION_COMPLETED, 'complete_execution', operator);
    }
    startSettlement(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.SETTLEMENT_STARTED, 'start_settlement', operator);
    }
    completeSettlement(batchId, operator) {
        return this.transitionBatchStatus(batchId, types_1.InvitationBatchStatus.SETTLEMENT_COMPLETED, 'complete_settlement', operator);
    }
    transitionBatchStatus(batchId, toStatus, operation, operator) {
        const batch = this.db.getBatch(batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId }
                }
            };
        }
        const transitionResult = (0, stateMachine_1.validateStateTransition)('batch', batch.status, toStatus, operation);
        if (!transitionResult.success) {
            return {
                success: false,
                error: transitionResult.error
            };
        }
        const context = {
            entityId: batchId,
            operator,
            additionalData: {
                availableOperations: (0, stateMachine_1.getAvailableOperations)('batch', batch.status)
            }
        };
        const event = (0, stateMachine_1.createEventRecord)('batch', operation, context, batch.status, toStatus);
        batch.status = toStatus;
        batch.updatedAt = new Date();
        const saved = this.db.saveBatch(batch, batch.version);
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    createEnrollment(input, operator) {
        const batch = this.db.getBatch(input.batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId: input.batchId }
                }
            };
        }
        if (batch.status !== types_1.InvitationBatchStatus.ENROLLMENT_STARTED) {
            return {
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_OPEN',
                    message: '该批次当前不在报名阶段',
                    details: { batchStatus: batch.status }
                }
            };
        }
        const existing = this.db.getEnrollmentByBatchAndEnterprise(input.batchId, input.enterpriseId);
        if (existing) {
            return {
                success: false,
                error: {
                    code: 'DUPLICATE_ENROLLMENT',
                    message: '该企业已在此批次报名，不允许重复提交',
                    details: {
                        batchId: input.batchId,
                        enterpriseId: input.enterpriseId,
                        existingEnrollmentId: existing.id
                    }
                }
            };
        }
        if (input.declaredCapacity <= 0) {
            return {
                success: false,
                error: {
                    code: 'INVALID_DECLARED_CAPACITY',
                    message: '申报容量必须大于 0',
                    details: { declaredCapacity: input.declaredCapacity }
                }
            };
        }
        const now = new Date();
        const enrollment = {
            id: (0, uuid_1.v4)(),
            ...input,
            status: types_1.EnrollmentStatus.PENDING_REVIEW,
            submittedAt: now,
            createdAt: now,
            updatedAt: now,
            version: 1
        };
        const saved = this.db.saveEnrollment(enrollment);
        const event = (0, stateMachine_1.createEventRecord)('enrollment', 'create', { entityId: saved.id, operator }, undefined, types_1.EnrollmentStatus.PENDING_REVIEW, { ...input });
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    reviewEnrollment(input) {
        const enrollment = this.db.getEnrollment(input.enrollmentId);
        if (!enrollment) {
            return {
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_FOUND',
                    message: '报名记录不存在',
                    details: { enrollmentId: input.enrollmentId }
                }
            };
        }
        const toStatus = input.approved ? types_1.EnrollmentStatus.APPROVED : types_1.EnrollmentStatus.REJECTED;
        const operation = input.approved ? 'approve' : 'reject';
        const transitionResult = (0, stateMachine_1.validateStateTransition)('enrollment', enrollment.status, toStatus, operation);
        if (!transitionResult.success) {
            return {
                success: false,
                error: transitionResult.error
            };
        }
        const event = (0, stateMachine_1.createEventRecord)('enrollment', operation, {
            entityId: enrollment.id,
            operator: input.operator,
            notes: input.reviewComment
        }, enrollment.status, toStatus, { reviewComment: input.reviewComment });
        enrollment.status = toStatus;
        enrollment.reviewComment = input.reviewComment;
        enrollment.reviewedAt = new Date();
        enrollment.updatedAt = new Date();
        const saved = this.db.saveEnrollment(enrollment, enrollment.version);
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    submitExecutionRecord(input, operator) {
        const batch = this.db.getBatch(input.batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId: input.batchId }
                }
            };
        }
        if (batch.status !== types_1.InvitationBatchStatus.EXECUTION_STARTED) {
            return {
                success: false,
                error: {
                    code: 'EXECUTION_NOT_ACTIVE',
                    message: '该批次当前不在执行阶段',
                    details: { batchStatus: batch.status }
                }
            };
        }
        const enrollment = this.db.getEnrollment(input.enrollmentId);
        if (!enrollment) {
            return {
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_FOUND',
                    message: '报名记录不存在',
                    details: { enrollmentId: input.enrollmentId }
                }
            };
        }
        if (enrollment.status !== types_1.EnrollmentStatus.APPROVED) {
            return {
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_APPROVED',
                    message: '只有已通过的报名才能提交执行记录',
                    details: { enrollmentStatus: enrollment.status }
                }
            };
        }
        if (input.baselineLoad < 0 || input.actualLoad < 0) {
            return {
                success: false,
                error: {
                    code: 'INVALID_LOAD_VALUE',
                    message: '负荷值不能为负数',
                    details: {
                        baselineLoad: input.baselineLoad,
                        actualLoad: input.actualLoad
                    }
                }
            };
        }
        const record = {
            id: (0, uuid_1.v4)(),
            ...input,
            createdAt: new Date(),
            version: 1
        };
        const saved = this.db.saveExecutionRecord(record);
        const event = (0, stateMachine_1.createEventRecord)('execution', 'submit', { entityId: enrollment.id, operator }, undefined, undefined, { ...input });
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    calculateDeviationForEnrollment(enrollmentId) {
        const enrollment = this.db.getEnrollment(enrollmentId);
        if (!enrollment) {
            return {
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_FOUND',
                    message: '报名记录不存在',
                    details: { enrollmentId }
                }
            };
        }
        const batch = this.db.getBatch(enrollment.batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId: enrollment.batchId }
                }
            };
        }
        const records = this.db.getExecutionRecordsByEnrollment(enrollmentId);
        const validation = (0, deviationCalculator_1.validateExecutionRecords)(records, batch.executionStartTime, batch.executionEndTime);
        if (!validation.isValid) {
            return {
                success: false,
                error: {
                    code: 'INVALID_EXECUTION_RECORDS',
                    message: '执行记录验证失败',
                    details: { errors: validation.errors }
                }
            };
        }
        const deviationResult = (0, deviationCalculator_1.calculateDeviation)(records, enrollment.declaredCapacity, deviationCalculator_1.DEFAULT_DEVIATION_CONFIG);
        if (!deviationResult.success) {
            return deviationResult;
        }
        return {
            success: true,
            data: {
                deviationResult: deviationResult.data,
                validation
            }
        };
    }
    calculateSettlementForEnrollment(enrollmentId, operator) {
        const deviationResult = this.calculateDeviationForEnrollment(enrollmentId);
        if (!deviationResult.success) {
            return deviationResult;
        }
        const enrollment = this.db.getEnrollment(enrollmentId);
        const batch = this.db.getBatch(enrollment.batchId);
        const settlementInput = {
            enrollmentId,
            batchId: enrollment.batchId,
            enterpriseId: enrollment.enterpriseId,
            deviationResult: deviationResult.data.deviationResult,
            unitPrice: batch.unitPrice,
            config: settlementCalculator_1.DEFAULT_SETTLEMENT_CONFIG
        };
        const calculationResult = (0, settlementCalculator_1.calculateSettlementAmount)(settlementInput);
        if (!calculationResult.success) {
            return calculationResult;
        }
        const hasErrors = !deviationResult.data.validation.isValid ||
            deviationResult.data.validation.errors.length > 0;
        const status = (0, settlementCalculator_1.determineSettlementStatus)(deviationResult.data.deviationResult, hasErrors);
        const now = new Date();
        const settlement = {
            id: (0, uuid_1.v4)(),
            enrollmentId,
            batchId: enrollment.batchId,
            enterpriseId: enrollment.enterpriseId,
            settlementAmount: calculationResult.data.settlementAmount,
            deviationRate: calculationResult.data.deviationRate,
            reductionAmount: calculationResult.data.reductionAmount,
            status,
            settlementTime: status === types_1.SettlementStatus.COMPLETED ? now : undefined,
            retryCount: 0,
            createdAt: now,
            updatedAt: now,
            version: 1
        };
        const saved = this.db.saveSettlementResult(settlement);
        const event = (0, stateMachine_1.createEventRecord)('settlement', 'calculate', { entityId: enrollmentId, operator }, undefined, status, {
            settlementAmount: saved.settlementAmount,
            deviationRate: saved.deviationRate,
            reductionAmount: saved.reductionAmount
        });
        this.db.saveEvent(event);
        return {
            success: true,
            data: saved,
            events: [event]
        };
    }
    calculateSettlementForBatch(batchId, operator) {
        const enrollments = this.db.getEnrollmentsByBatch(batchId).filter(e => e.status === types_1.EnrollmentStatus.APPROVED);
        const results = [];
        const errors = [];
        for (const enrollment of enrollments) {
            const result = this.calculateSettlementForEnrollment(enrollment.id, operator);
            if (result.success && result.data) {
                results.push(result.data);
            }
            else if (result.error) {
                errors.push(`${enrollment.enterpriseName}: ${result.error.message}`);
            }
        }
        const batch = this.db.getBatch(batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId }
                }
            };
        }
        const summaryResults = results.map(r => ({
            deviationResult: {
                enrollmentId: r.enrollmentId,
                averageBaseline: 0,
                averageActual: 0,
                achievedReduction: r.reductionAmount,
                expectedReduction: 0,
                deviationRate: r.deviationRate,
                passThreshold: deviationCalculator_1.DEFAULT_DEVIATION_CONFIG.passThreshold,
                isPassed: r.status === types_1.SettlementStatus.COMPLETED,
                calculatedAt: new Date()
            },
            settlementAmount: r.settlementAmount,
            reductionAmount: r.reductionAmount
        }));
        const summary = (0, settlementCalculator_1.calculateSettlementSummary)(summaryResults);
        return {
            success: errors.length === 0 || results.length > 0,
            data: {
                results,
                summary
            },
            error: errors.length > 0 ? {
                code: 'PARTIAL_SETTLEMENT_ERRORS',
                message: '部分企业结算失败',
                details: { errors }
            } : undefined
        };
    }
    getBatchSummary(batchId) {
        const batch = this.db.getBatch(batchId);
        if (!batch) {
            return {
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在',
                    details: { batchId }
                }
            };
        }
        const enrollments = this.db.getEnrollmentsByBatch(batchId);
        const settlementResults = this.db.getSettlementResultsByBatch(batchId);
        const enrollmentDetails = enrollments.map(e => {
            const executions = this.db.getExecutionRecordsByEnrollment(e.id);
            const settlement = settlementResults.find(s => s.enrollmentId === e.id);
            return {
                enrollment: e,
                executionCount: executions.length,
                settlementResult: settlement
            };
        });
        const events = this.db.getEventsByBatch(batchId);
        const timeline = (0, eventReplay_1.getEventTimeline)(events);
        const summaryData = settlementResults.map(r => ({
            deviationResult: {
                enrollmentId: r.enrollmentId,
                averageBaseline: 0,
                averageActual: 0,
                achievedReduction: r.reductionAmount,
                expectedReduction: 0,
                deviationRate: r.deviationRate,
                passThreshold: deviationCalculator_1.DEFAULT_DEVIATION_CONFIG.passThreshold,
                isPassed: r.status === types_1.SettlementStatus.COMPLETED,
                calculatedAt: new Date()
            },
            settlementAmount: r.settlementAmount,
            reductionAmount: r.reductionAmount
        }));
        const summary = summaryData.length > 0 ? (0, settlementCalculator_1.calculateSettlementSummary)(summaryData) : undefined;
        return {
            success: true,
            data: {
                batch,
                enrollments: enrollmentDetails,
                settlementSummary: summary,
                eventTimeline: timeline
            }
        };
    }
    replayBatchEvents(batchId) {
        const events = this.db.getEventsByBatch(batchId);
        return (0, eventReplay_1.replayEvents)(events);
    }
    getBatch(batchId) {
        return this.db.getBatch(batchId);
    }
    getAllBatches() {
        return this.db.getAllBatches();
    }
    getEnrollment(enrollmentId) {
        return this.db.getEnrollment(enrollmentId);
    }
    getEnrollmentsByBatch(batchId) {
        return this.db.getEnrollmentsByBatch(batchId);
    }
    getExecutionRecords(enrollmentId) {
        return this.db.getExecutionRecordsByEnrollment(enrollmentId);
    }
    getSettlementResult(enrollmentId) {
        return this.db.getSettlementResult(enrollmentId);
    }
    getEventsByBatch(batchId) {
        return this.db.getEventsByBatch(batchId);
    }
    getEventsByEnrollment(enrollmentId) {
        return this.db.getEventsByEnrollment(enrollmentId);
    }
}
exports.InvitationService = InvitationService;
//# sourceMappingURL=invitationService.js.map