"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscardById = exports.getDiscardStatistics = exports.getDiscardRecords = exports.createDiscard = void 0;
const database_1 = require("../config/database");
const auditService_1 = require("./auditService");
const client_1 = require("@prisma/client");
const createDiscard = async (params) => {
    const batch = await database_1.prisma.reagentBatch.findUnique({
        where: { id: params.batchId },
    });
    if (!batch) {
        throw new Error('试剂批号不存在');
    }
    if (params.discardedQty > batch.currentQty) {
        throw new Error('废弃数量不能大于当前库存');
    }
    if (params.discardedQty <= 0) {
        throw new Error('废弃数量必须大于0');
    }
    const discardRecord = await database_1.prisma.$transaction(async (tx) => {
        const record = await tx.discardRecord.create({
            data: {
                batchId: params.batchId,
                reason: params.reason,
                details: params.details,
                discardedQty: params.discardedQty,
                createdById: params.createdBy,
            },
        });
        const newQty = batch.currentQty - params.discardedQty;
        const updateData = { currentQty: newQty };
        if (newQty <= 0 || params.reason === client_1.DiscardReason.EXPIRED) {
            updateData.status = client_1.ReagentStatus.DISCARDED;
        }
        await tx.reagentBatch.update({
            where: { id: params.batchId },
            data: updateData,
        });
        return record;
    });
    await (0, auditService_1.createAuditLog)({
        action: 'CREATE_DISCARD',
        entityType: 'DISCARD',
        entityId: discardRecord.id,
        userId: params.createdBy,
        newValues: discardRecord,
    });
    await (0, auditService_1.createAuditLog)({
        action: 'UPDATE_BATCH_QTY',
        entityType: 'BATCH',
        entityId: params.batchId,
        userId: params.createdBy,
        oldValues: { currentQty: batch.currentQty, status: batch.status },
        newValues: {
            currentQty: batch.currentQty - params.discardedQty,
            status: (batch.currentQty - params.discardedQty <= 0 || params.reason === client_1.DiscardReason.EXPIRED)
                ? client_1.ReagentStatus.DISCARDED
                : batch.status,
        },
    });
    return discardRecord;
};
exports.createDiscard = createDiscard;
const getDiscardRecords = async (params) => {
    const { page = 1, limit = 50, batchId, reason, startDate, endDate } = params;
    const where = {};
    if (batchId)
        where.batchId = batchId;
    if (reason)
        where.reason = reason;
    if (startDate || endDate) {
        where.discardedAt = {};
        if (startDate)
            where.discardedAt.gte = new Date(startDate);
        if (endDate)
            where.discardedAt.lte = new Date(endDate);
    }
    const [records, total] = await Promise.all([
        database_1.prisma.discardRecord.findMany({
            where,
            include: {
                batch: {
                    include: {
                        reagent: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                    },
                },
            },
            orderBy: { discardedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.discardRecord.count({ where }),
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
exports.getDiscardRecords = getDiscardRecords;
const getDiscardStatistics = async (params) => {
    const { startDate, endDate, reagentId } = params;
    const where = {};
    if (startDate || endDate) {
        where.discardedAt = {};
        if (startDate)
            where.discardedAt.gte = new Date(startDate);
        if (endDate)
            where.discardedAt.lte = new Date(endDate);
    }
    if (reagentId) {
        where.batch = {
            reagentId,
        };
    }
    const discards = await database_1.prisma.discardRecord.findMany({
        where,
        include: {
            batch: {
                include: {
                    reagent: true,
                },
            },
        },
    });
    const stats = {
        totalRecords: discards.length,
        totalQty: discards.reduce((sum, d) => sum + d.discardedQty, 0),
        byReason: {},
        byReagent: {},
    };
    discards.forEach((d) => {
        if (!stats.byReason[d.reason]) {
            stats.byReason[d.reason] = { count: 0, qty: 0 };
        }
        stats.byReason[d.reason].count++;
        stats.byReason[d.reason].qty += d.discardedQty;
        const reagentName = d.batch.reagent.name;
        if (!stats.byReagent[d.batch.reagentId]) {
            stats.byReagent[d.batch.reagentId] = { name: reagentName, count: 0, qty: 0 };
        }
        stats.byReagent[d.batch.reagentId].count++;
        stats.byReagent[d.batch.reagentId].qty += d.discardedQty;
    });
    return stats;
};
exports.getDiscardStatistics = getDiscardStatistics;
const getDiscardById = async (id) => {
    return database_1.prisma.discardRecord.findUnique({
        where: { id },
        include: {
            batch: {
                include: {
                    reagent: true,
                },
            },
            createdBy: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                },
            },
        },
    });
};
exports.getDiscardById = getDiscardById;
//# sourceMappingURL=discardService.js.map