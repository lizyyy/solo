"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 50, batchId, isResolved } = req.query;
    const where = {};
    if (batchId)
        where.batchId = batchId;
    if (isResolved === 'true')
        where.isResolved = true;
    if (isResolved === 'false')
        where.isResolved = false;
    const [records, total] = await Promise.all([
        database_1.prisma.blockRecord.findMany({
            where,
            include: {
                batch: {
                    include: {
                        reagent: true,
                    },
                },
                experiment: true,
                reviewRecords: {
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
            },
            orderBy: { blockedAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        }),
        database_1.prisma.blockRecord.count({ where }),
    ]);
    res.json({
        records,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
    });
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const record = await database_1.prisma.blockRecord.findUnique({
        where: { id: req.params.id },
        include: {
            batch: {
                include: {
                    reagent: true,
                },
            },
            experiment: true,
            reviewRecords: {
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
        },
    });
    if (!record) {
        return res.status(404).json({ error: '拦截记录不存在' });
    }
    res.json(record);
}));
router.post('/:id/resolve', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { resolutionNotes } = req.body;
    const oldRecord = await database_1.prisma.blockRecord.findUnique({
        where: { id: req.params.id },
    });
    if (!oldRecord) {
        return res.status(404).json({ error: '拦截记录不存在' });
    }
    if (oldRecord.isResolved) {
        return res.status(400).json({ error: '该拦截记录已被处理' });
    }
    const record = await database_1.prisma.blockRecord.update({
        where: { id: req.params.id },
        data: {
            isResolved: true,
            resolvedAt: new Date(),
            resolvedBy: req.user.id,
            resolutionNotes,
        },
    });
    res.json(record);
}));
exports.default = router;
//# sourceMappingURL=blocks.js.map