"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEntityTimeline = exports.getAuditLogs = exports.createAuditLog = void 0;
const database_1 = require("../config/database");
const createAuditLog = async (params) => {
    return database_1.prisma.auditLog.create({
        data: {
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            userId: params.userId,
            oldValues: params.oldValues,
            newValues: params.newValues,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
        },
    });
};
exports.createAuditLog = createAuditLog;
const getAuditLogs = async (params) => {
    const { entityType, entityId, userId, action, startDate, endDate, page = 1, limit = 50, } = params;
    const where = {};
    if (entityType)
        where.entityType = entityType;
    if (entityId)
        where.entityId = entityId;
    if (userId)
        where.userId = userId;
    if (action)
        where.action = action;
    if (startDate || endDate) {
        where.timestamp = {};
        if (startDate)
            where.timestamp.gte = new Date(startDate);
        if (endDate)
            where.timestamp.lte = new Date(endDate);
    }
    const [logs, total] = await Promise.all([
        database_1.prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        database_1.prisma.auditLog.count({ where }),
    ]);
    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};
exports.getAuditLogs = getAuditLogs;
const getEntityTimeline = async (entityType, entityId) => {
    return database_1.prisma.auditLog.findMany({
        where: {
            entityType,
            entityId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                },
            },
        },
        orderBy: { timestamp: 'asc' },
    });
};
exports.getEntityTimeline = getEntityTimeline;
//# sourceMappingURL=auditService.js.map