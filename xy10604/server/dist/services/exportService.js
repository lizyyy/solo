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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatistics = exports.getReviewDetailsForExport = exports.generateExport = void 0;
const database_1 = require("../config/database");
const ExcelJS = __importStar(require("exceljs"));
const formatDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
};
const formatDateTime = (date) => {
    return new Date(date).toISOString().replace('T', ' ').slice(0, 19);
};
const generateExport = async (params) => {
    const { startDate, endDate, reviewerId, includeAuditLogs = true, includeReviews = true, includeDiscards = true } = params;
    const where = {};
    if (startDate || endDate) {
        where.reviewedAt = {};
        if (startDate)
            where.reviewedAt.gte = new Date(startDate);
        if (endDate)
            where.reviewedAt.lte = new Date(endDate);
    }
    if (reviewerId)
        where.reviewerId = reviewerId;
    const [reviews, discards, auditLogs] = await Promise.all([
        includeReviews
            ? database_1.prisma.reviewRecord.findMany({
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
                orderBy: { reviewedAt: 'desc' },
            })
            : [],
        includeDiscards
            ? database_1.prisma.discardRecord.findMany({
                where: {
                    discardedAt: {
                        gte: startDate ? new Date(startDate) : undefined,
                        lte: endDate ? new Date(endDate) : undefined,
                    },
                },
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
            })
            : [],
        includeAuditLogs
            ? database_1.prisma.auditLog.findMany({
                where: {
                    timestamp: {
                        gte: startDate ? new Date(startDate) : undefined,
                        lte: endDate ? new Date(endDate) : undefined,
                    },
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
                orderBy: { timestamp: 'desc' },
            })
            : [],
    ]);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Reagent Management System';
    workbook.created = new Date();
    const summarySheet = workbook.addWorksheet('摘要');
    summarySheet.columns = [
        { header: '报告生成时间', key: 'generatedAt', width: 25 },
        { header: '时间范围', key: 'dateRange', width: 30 },
        { header: '复核记录数', key: 'reviewCount', width: 15 },
        { header: '废弃记录数', key: 'discardCount', width: 15 },
        { header: '操作日志数', key: 'auditCount', width: 15 },
    ];
    summarySheet.addRow({
        generatedAt: formatDateTime(new Date()),
        dateRange: `${startDate || '无限制'} - ${endDate || '无限制'}`,
        reviewCount: reviews.length,
        discardCount: discards.length,
        auditCount: auditLogs.length,
    });
    if (includeReviews && reviews.length > 0) {
        const reviewSheet = workbook.addWorksheet('复核记录');
        reviewSheet.columns = [
            { header: '复核时间', key: 'reviewedAt', width: 20 },
            { header: '复核人', key: 'reviewer', width: 15 },
            { header: '复核角色', key: 'role', width: 15 },
            { header: '试剂名称', key: 'reagent', width: 20 },
            { header: '批号', key: 'batchNumber', width: 15 },
            { header: '实验名称', key: 'experimentName', width: 20 },
            { header: '决策', key: 'decision', width: 10 },
            { header: '原因', key: 'reason', width: 40 },
            { header: '备注', key: 'notes', width: 30 },
            { header: '影响记录', key: 'affectedRecords', width: 50 },
        ];
        reviews.forEach((r) => {
            reviewSheet.addRow({
                reviewedAt: formatDateTime(r.reviewedAt),
                reviewer: r.reviewer.name,
                role: r.reviewer.role,
                reagent: r.batch.reagent.name,
                batchNumber: r.batch.batchNumber,
                experimentName: r.experiment?.name || '-',
                decision: r.decision,
                reason: r.reason,
                notes: r.notes || '-',
                affectedRecords: r.affectedRecords
                    ? JSON.stringify(r.affectedRecords, null, 2)
                    : '-',
            });
        });
    }
    if (includeDiscards && discards.length > 0) {
        const discardSheet = workbook.addWorksheet('废弃记录');
        discardSheet.columns = [
            { header: '废弃时间', key: 'discardedAt', width: 20 },
            { header: '操作人', key: 'operator', width: 15 },
            { header: '试剂名称', key: 'reagent', width: 20 },
            { header: '批号', key: 'batchNumber', width: 15 },
            { header: '废弃原因', key: 'reason', width: 15 },
            { header: '废弃数量', key: 'qty', width: 12 },
            { header: '详情', key: 'details', width: 40 },
        ];
        discards.forEach((d) => {
            discardSheet.addRow({
                discardedAt: formatDateTime(d.discardedAt),
                operator: d.createdBy.name,
                reagent: d.batch.reagent.name,
                batchNumber: d.batch.batchNumber,
                reason: d.reason,
                qty: `${d.discardedQty} ${d.batch.unit}`,
                details: d.details || '-',
            });
        });
    }
    if (includeAuditLogs && auditLogs.length > 0) {
        const auditSheet = workbook.addWorksheet('操作日志');
        auditSheet.columns = [
            { header: '操作时间', key: 'timestamp', width: 20 },
            { header: '操作人', key: 'user', width: 15 },
            { header: '操作类型', key: 'action', width: 25 },
            { header: '实体类型', key: 'entityType', width: 15 },
            { header: '实体ID', key: 'entityId', width: 40 },
            { header: '修改前', key: 'oldValues', width: 50 },
            { header: '修改后', key: 'newValues', width: 50 },
        ];
        auditLogs.forEach((log) => {
            auditSheet.addRow({
                timestamp: formatDateTime(log.timestamp),
                user: log.user.name,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                oldValues: log.oldValues
                    ? JSON.stringify(log.oldValues, null, 2).slice(0, 500)
                    : '-',
                newValues: log.newValues
                    ? JSON.stringify(log.newValues, null, 2).slice(0, 500)
                    : '-',
            });
        });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};
exports.generateExport = generateExport;
const getReviewDetailsForExport = async (reviewId) => {
    const review = await database_1.prisma.reviewRecord.findUnique({
        where: { id: reviewId },
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
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                        },
                    },
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
    if (!review) {
        throw new Error('复核记录不存在');
    }
    const relatedAuditLogs = await database_1.prisma.auditLog.findMany({
        where: {
            OR: [
                { entityId: review.batchId, entityType: 'BATCH' },
                { entityId: review.experimentId || '', entityType: 'EXPERIMENT' },
                { entityId: review.id, entityType: 'REVIEW' },
            ],
            timestamp: {
                gte: new Date(review.reviewedAt.getTime() - 24 * 60 * 60 * 1000),
                lte: new Date(review.reviewedAt.getTime() + 24 * 60 * 60 * 1000),
            },
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
    return {
        review,
        relatedAuditLogs,
        affectedRecords: review.affectedRecords,
    };
};
exports.getReviewDetailsForExport = getReviewDetailsForExport;
const getStatistics = async (params) => {
    const { startDate, endDate } = params;
    const dateFilter = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
    };
    const [batches, experiments, reviews, discards] = await Promise.all([
        database_1.prisma.reagentBatch.aggregate({
            _count: {
                id: true,
            },
        }),
        database_1.prisma.experiment.groupBy({
            by: ['status'],
            _count: {
                id: true,
            },
        }),
        database_1.prisma.reviewRecord.groupBy({
            by: ['decision'],
            _count: {
                id: true,
            },
        }),
        database_1.prisma.discardRecord.aggregate({
            _count: {
                id: true,
            },
            _sum: {
                discardedQty: true,
            },
        }),
    ]);
    return {
        totalBatches: batches._count.id,
        experimentsByStatus: experiments.map((e) => ({
            status: e.status,
            count: e._count.id,
        })),
        reviewsByDecision: reviews.map((r) => ({
            decision: r.decision,
            count: r._count.id,
        })),
        totalDiscards: discards._count.id,
        totalDiscardedQty: discards._sum.discardedQty,
    };
};
exports.getStatistics = getStatistics;
//# sourceMappingURL=exportService.js.map