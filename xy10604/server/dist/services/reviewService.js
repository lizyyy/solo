"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewById = exports.getReviewRecords = exports.createReview = void 0;
const database_1 = require("../config/database");
const auditService_1 = require("./auditService");
const client_1 = require("@prisma/client");
const createReview = async (params) => {
    const affectedRecords = [];
    if (params.decision === client_1.ReviewDecision.APPROVE) {
        if (params.experimentId) {
            const oldExperiment = await database_1.prisma.experiment.findUnique({
                where: { id: params.experimentId },
            });
            const experiment = await database_1.prisma.experiment.update({
                where: { id: params.experimentId },
                data: { status: client_1.ExperimentStatus.APPROVED },
            });
            affectedRecords.push({
                type: 'EXPERIMENT',
                id: params.experimentId,
                oldStatus: oldExperiment?.status,
                newStatus: client_1.ExperimentStatus.APPROVED,
            });
            await (0, auditService_1.createAuditLog)({
                action: 'REVIEW_APPROVE_EXPERIMENT',
                entityType: 'EXPERIMENT',
                entityId: params.experimentId,
                userId: params.reviewerId,
                oldValues: oldExperiment,
                newValues: experiment,
            });
        }
        if (params.blockRecordId) {
            const oldBlockRecord = await database_1.prisma.blockRecord.findUnique({
                where: { id: params.blockRecordId },
            });
            const blockRecord = await database_1.prisma.blockRecord.update({
                where: { id: params.blockRecordId },
                data: {
                    isResolved: true,
                    resolvedAt: new Date(),
                    resolvedBy: params.reviewerId,
                    resolutionNotes: params.reason,
                },
            });
            affectedRecords.push({
                type: 'BLOCK_RECORD',
                id: params.blockRecordId,
                action: 'RESOLVED',
            });
            if (oldBlockRecord?.experimentId) {
                const oldExperiment = await database_1.prisma.experiment.findUnique({
                    where: { id: oldBlockRecord.experimentId },
                });
                const experiment = await database_1.prisma.experiment.update({
                    where: { id: oldBlockRecord.experimentId },
                    data: { status: client_1.ExperimentStatus.APPROVED },
                });
                affectedRecords.push({
                    type: 'EXPERIMENT',
                    id: oldBlockRecord.experimentId,
                    oldStatus: oldExperiment?.status,
                    newStatus: client_1.ExperimentStatus.APPROVED,
                });
                await (0, auditService_1.createAuditLog)({
                    action: 'REVIEW_APPROVE_EXPERIMENT',
                    entityType: 'EXPERIMENT',
                    entityId: oldBlockRecord.experimentId,
                    userId: params.reviewerId,
                    oldValues: oldExperiment,
                    newValues: experiment,
                });
            }
        }
        if (params.batchId) {
            const oldBatch = await database_1.prisma.reagentBatch.findUnique({
                where: { id: params.batchId },
            });
            if (oldBatch?.status === client_1.ReagentStatus.BLOCKED) {
                const batch = await database_1.prisma.reagentBatch.update({
                    where: { id: params.batchId },
                    data: { status: client_1.ReagentStatus.ACTIVE },
                });
                affectedRecords.push({
                    type: 'BATCH',
                    id: params.batchId,
                    oldStatus: oldBatch.status,
                    newStatus: client_1.ReagentStatus.ACTIVE,
                });
                await (0, auditService_1.createAuditLog)({
                    action: 'REVIEW_UNBLOCK_BATCH',
                    entityType: 'BATCH',
                    entityId: params.batchId,
                    userId: params.reviewerId,
                    oldValues: oldBatch,
                    newValues: batch,
                });
            }
        }
    }
    if (params.decision === client_1.ReviewDecision.REJECT) {
        if (params.experimentId) {
            const oldExperiment = await database_1.prisma.experiment.findUnique({
                where: { id: params.experimentId },
            });
            const experiment = await database_1.prisma.experiment.update({
                where: { id: params.experimentId },
                data: { status: client_1.ExperimentStatus.CANCELLED },
            });
            affectedRecords.push({
                type: 'EXPERIMENT',
                id: params.experimentId,
                oldStatus: oldExperiment?.status,
                newStatus: client_1.ExperimentStatus.CANCELLED,
            });
            await (0, auditService_1.createAuditLog)({
                action: 'REVIEW_REJECT_EXPERIMENT',
                entityType: 'EXPERIMENT',
                entityId: params.experimentId,
                userId: params.reviewerId,
                oldValues: oldExperiment,
                newValues: experiment,
            });
        }
        if (params.blockRecordId) {
            const oldBlockRecord = await database_1.prisma.blockRecord.findUnique({
                where: { id: params.blockRecordId },
            });
            if (oldBlockRecord?.experimentId) {
                const oldExperiment = await database_1.prisma.experiment.findUnique({
                    where: { id: oldBlockRecord.experimentId },
                });
                const experiment = await database_1.prisma.experiment.update({
                    where: { id: oldBlockRecord.experimentId },
                    data: { status: client_1.ExperimentStatus.CANCELLED },
                });
                affectedRecords.push({
                    type: 'EXPERIMENT',
                    id: oldBlockRecord.experimentId,
                    oldStatus: oldExperiment?.status,
                    newStatus: client_1.ExperimentStatus.CANCELLED,
                });
                await (0, auditService_1.createAuditLog)({
                    action: 'REVIEW_REJECT_EXPERIMENT',
                    entityType: 'EXPERIMENT',
                    entityId: oldBlockRecord.experimentId,
                    userId: params.reviewerId,
                    oldValues: oldExperiment,
                    newValues: experiment,
                });
            }
        }
    }
    const reviewRecord = await database_1.prisma.reviewRecord.create({
        data: {
            batchId: params.batchId,
            experimentId: params.experimentId,
            openRecordId: params.openRecordId,
            blockRecordId: params.blockRecordId,
            reviewerId: params.reviewerId,
            decision: params.decision,
            reason: params.reason,
            notes: params.notes,
            affectedRecords,
        },
    });
    await (0, auditService_1.createAuditLog)({
        action: 'CREATE_REVIEW',
        entityType: 'REVIEW',
        entityId: reviewRecord.id,
        userId: params.reviewerId,
        newValues: {
            ...reviewRecord,
            affectedRecords,
        },
    });
    return reviewRecord;
};
exports.createReview = createReview;
const getReviewRecords = async (params) => {
    const { page = 1, limit = 50, batchId, experimentId, reviewerId, decision, startDate, endDate, } = params;
    const where = {};
    if (batchId)
        where.batchId = batchId;
    if (experimentId)
        where.experimentId = experimentId;
    if (reviewerId)
        where.reviewerId = reviewerId;
    if (decision)
        where.decision = decision;
    if (startDate || endDate) {
        where.reviewedAt = {};
        if (startDate)
            where.reviewedAt.gte = new Date(startDate);
        if (endDate)
            where.reviewedAt.lte = new Date(endDate);
    }
    const [records, total] = await Promise.all([
        database_1.prisma.reviewRecord.findMany({
            where,
            include: {
                reviewer: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        role: true,
                    },
                },
                batch: {
                    include: {
                        reagent: true,
                    },
                },
                experiment: true,
                blockRecord: true,
            },
            orderBy: { reviewedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.reviewRecord.count({ where }),
    ]);
    return {
        records,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
exports.getReviewRecords = getReviewRecords;
const getReviewById = async (id) => {
    return database_1.prisma.reviewRecord.findUnique({
        where: { id },
        include: {
            reviewer: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                },
            },
            batch: {
                include: {
                    reagent: true,
                },
            },
            experiment: {
                include: {
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                        },
                    },
                },
            },
            blockRecord: true,
        },
    });
};
exports.getReviewById = getReviewById;
//# sourceMappingURL=reviewService.js.map