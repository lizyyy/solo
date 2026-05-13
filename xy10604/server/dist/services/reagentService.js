"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBatchById = exports.getBatches = exports.createBatch = exports.getReagentById = exports.getReagents = exports.updateReagent = exports.createReagent = void 0;
const database_1 = require("../config/database");
const auditService_1 = require("./auditService");
const client_1 = require("@prisma/client");
const createReagent = async (params) => {
    const reagent = await database_1.prisma.reagent.create({
        data: {
            name: params.name,
            code: params.code,
            description: params.description,
            defaultExpiryDays: params.defaultExpiryDays || 30,
            nearExpiryDays: params.nearExpiryDays || 7,
        },
    });
    await (0, auditService_1.createAuditLog)({
        action: 'CREATE_REAGENT',
        entityType: 'REAGENT',
        entityId: reagent.id,
        userId: params.createdBy,
        newValues: reagent,
    });
    return reagent;
};
exports.createReagent = createReagent;
const updateReagent = async (id, params, userId) => {
    const oldReagent = await database_1.prisma.reagent.findUnique({ where: { id } });
    const reagent = await database_1.prisma.reagent.update({
        where: { id },
        data: params,
    });
    await (0, auditService_1.createAuditLog)({
        action: 'UPDATE_REAGENT',
        entityType: 'REAGENT',
        entityId: id,
        userId,
        oldValues: oldReagent,
        newValues: reagent,
    });
    return reagent;
};
exports.updateReagent = updateReagent;
const getReagents = async (params) => {
    const { page = 1, limit = 50, isActive, search } = params;
    const where = {};
    if (typeof isActive === 'boolean')
        where.isActive = isActive;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ];
    }
    const [reagents, total] = await Promise.all([
        database_1.prisma.reagent.findMany({
            where,
            include: {
                batches: {
                    select: {
                        id: true,
                        batchNumber: true,
                        status: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.reagent.count({ where }),
    ]);
    return {
        reagents,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
exports.getReagents = getReagents;
const getReagentById = async (id) => {
    return database_1.prisma.reagent.findUnique({
        where: { id },
        include: {
            batches: {
                orderBy: { createdAt: 'desc' },
            },
        },
    });
};
exports.getReagentById = getReagentById;
const createBatch = async (params) => {
    const existingBatch = await database_1.prisma.reagentBatch.findUnique({
        where: {
            reagentId_batchNumber: {
                reagentId: params.reagentId,
                batchNumber: params.batchNumber,
            },
        },
    });
    if (existingBatch) {
        throw new Error('该试剂已有相同批号');
    }
    if (new Date(params.productionDate) >= new Date(params.expiryDate)) {
        throw new Error('生产日期必须早于有效期');
    }
    const batch = await database_1.prisma.reagentBatch.create({
        data: {
            reagentId: params.reagentId,
            batchNumber: params.batchNumber,
            productionDate: new Date(params.productionDate),
            expiryDate: new Date(params.expiryDate),
            originalQty: params.originalQty,
            currentQty: params.originalQty,
            unit: params.unit,
            status: client_1.ReagentStatus.PENDING,
            createdById: params.createdBy,
        },
    });
    await (0, auditService_1.createAuditLog)({
        action: 'CREATE_BATCH',
        entityType: 'BATCH',
        entityId: batch.id,
        userId: params.createdBy,
        newValues: batch,
    });
    return batch;
};
exports.createBatch = createBatch;
const getBatches = async (params) => {
    const { page = 1, limit = 50, reagentId, status, search } = params;
    const where = {};
    if (reagentId)
        where.reagentId = reagentId;
    if (status)
        where.status = status;
    if (search) {
        where.OR = [
            { batchNumber: { contains: search, mode: 'insensitive' } },
            { reagent: { name: { contains: search, mode: 'insensitive' } } },
        ];
    }
    const [batches, total] = await Promise.all([
        database_1.prisma.reagentBatch.findMany({
            where,
            include: {
                reagent: true,
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                    },
                },
                openRecords: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.reagentBatch.count({ where }),
    ]);
    return {
        batches,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
exports.getBatches = getBatches;
const getBatchById = async (id) => {
    return database_1.prisma.reagentBatch.findUnique({
        where: { id },
        include: {
            reagent: true,
            createdBy: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                },
            },
            openRecords: {
                orderBy: { createdAt: 'desc' },
            },
            experiments: {
                orderBy: { scheduledDate: 'desc' },
            },
            blockRecords: {
                orderBy: { blockedAt: 'desc' },
            },
            reviewRecords: {
                orderBy: { reviewedAt: 'desc' },
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                        },
                    },
                },
            },
            discardRecords: {
                orderBy: { discardedAt: 'desc' },
            },
        },
    });
};
exports.getBatchById = getBatchById;
//# sourceMappingURL=reagentService.js.map