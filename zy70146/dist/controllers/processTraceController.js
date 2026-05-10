"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTraceController = void 0;
const enums_1 = require("../types/enums");
const processTraceService_1 = require("../services/processTraceService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.processTraceController = {
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const trace = await processTraceService_1.processTraceService.getById(id);
        if (!trace) {
            throw new errorHandler_1.ApiError('流程记录不存在', 404);
        }
        res.json({
            success: true,
            data: trace,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { step, status, sloConfigId, limit } = req.query;
        const options = {};
        if (step && enums_1.ProcessStepValues.includes(step)) {
            options.step = step;
        }
        if (status && enums_1.ProcessStatusValues.includes(status)) {
            options.status = status;
        }
        if (sloConfigId)
            options.sloConfigId = sloConfigId;
        if (limit)
            options.limit = parseInt(limit, 10);
        const traces = await processTraceService_1.processTraceService.list(tenantId, options);
        res.json({
            success: true,
            data: traces,
        });
    }),
    getCurrentBlocker: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { sloConfigId } = req.query;
        const blocker = await processTraceService_1.processTraceService.getCurrentBlocker(tenantId, sloConfigId);
        res.json({
            success: true,
            data: blocker,
        });
    }),
    getTraceChain: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { traceId } = req.params;
        const chain = await processTraceService_1.processTraceService.getTraceChain(traceId);
        res.json({
            success: true,
            chainLength: chain.length,
            data: chain,
        });
    }),
};
//# sourceMappingURL=processTraceController.js.map