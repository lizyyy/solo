"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTraceService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.processTraceService = {
    async create(options) {
        return prisma_1.default.processTrace.create({
            data: {
                tenantId: options.tenantId,
                sloConfigId: options.sloConfigId,
                step: options.step,
                status: options.status,
                currentCheckpoint: options.currentCheckpoint,
                checkpointMessage: options.checkpointMessage,
                previousTraceId: options.previousTraceId,
                operator: options.operator,
                metadata: options.metadata ? JSON.stringify(options.metadata) : null,
            },
        });
    },
    async update(id, data) {
        const updateData = {
            status: data.status,
            currentCheckpoint: data.currentCheckpoint,
            checkpointMessage: data.checkpointMessage,
            operator: data.operator,
        };
        if (data.sloConfigId !== undefined)
            updateData.sloConfigId = data.sloConfigId;
        if (data.metadata !== undefined)
            updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
        return prisma_1.default.processTrace.update({
            where: { id },
            data: updateData,
        });
    },
    async getById(id) {
        const trace = await prisma_1.default.processTrace.findUnique({
            where: { id },
        });
        if (!trace)
            return null;
        let previousTrace = null;
        if (trace.previousTraceId) {
            previousTrace = await prisma_1.default.processTrace.findUnique({
                where: { id: trace.previousTraceId },
            });
        }
        return {
            ...trace,
            metadata: trace.metadata ? JSON.parse(trace.metadata) : null,
            previousTrace,
        };
    },
    async list(tenantId, options = {}) {
        const where = { tenantId };
        if (options.step)
            where.step = options.step;
        if (options.status)
            where.status = options.status;
        if (options.sloConfigId)
            where.sloConfigId = options.sloConfigId;
        const traces = await prisma_1.default.processTrace.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options.limit || 50,
        });
        return traces.map(trace => ({
            ...trace,
            metadata: trace.metadata ? JSON.parse(trace.metadata) : null,
        }));
    },
    async getCurrentBlocker(tenantId, sloConfigId) {
        const blockers = await prisma_1.default.processTrace.findMany({
            where: {
                tenantId,
                ...(sloConfigId ? { sloConfigId } : {}),
                status: {
                    in: ['REJECTED', 'PENDING'],
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        if (blockers.length === 0) {
            return {
                hasBlocker: false,
            };
        }
        const blocker = blockers[0];
        let previousTrace = null;
        if (blocker.previousTraceId) {
            previousTrace = await prisma_1.default.processTrace.findUnique({
                where: { id: blocker.previousTraceId },
            });
        }
        return {
            hasBlocker: true,
            currentBlocker: {
                ...blocker,
                metadata: blocker.metadata ? JSON.parse(blocker.metadata) : null,
            },
            previousTrace: previousTrace ? {
                ...previousTrace,
                metadata: previousTrace.metadata ? JSON.parse(previousTrace.metadata) : null,
            } : null,
        };
    },
    async getTraceChain(traceId) {
        const chain = [];
        let currentId = traceId;
        while (currentId) {
            const traceRecord = await prisma_1.default.processTrace.findUnique({
                where: { id: currentId },
            });
            if (!traceRecord)
                break;
            chain.unshift({
                ...traceRecord,
                metadata: traceRecord.metadata ? JSON.parse(traceRecord.metadata) : null,
            });
            currentId = traceRecord.previousTraceId;
        }
        return chain;
    },
};
//# sourceMappingURL=processTraceService.js.map