"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorSampleController = void 0;
const enums_1 = require("../types/enums");
const errorSampleService_1 = require("../services/errorSampleService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.errorSampleController = {
    create: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { serviceId, endpointId, source, errorType, errorMessage, statusCode, timestamp, durationMs, requestId, userId, metadata, operator } = req.body;
        if (!source) {
            throw new errorHandler_1.ApiError('错误来源必填', 400);
        }
        if (!enums_1.ErrorSourceValues.includes(source)) {
            throw new errorHandler_1.ApiError(`无效的错误来源，可选值: ${enums_1.ErrorSourceValues.join(', ')}`, 400);
        }
        const errorSample = await errorSampleService_1.errorSampleService.create({
            tenantId,
            serviceId,
            endpointId,
            source,
            errorType,
            errorMessage,
            statusCode,
            timestamp: timestamp ? new Date(timestamp) : undefined,
            durationMs,
            requestId,
            userId,
            metadata,
            operator,
        });
        res.status(201).json({
            success: true,
            data: errorSample,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { isDeducted, serviceId, endpointId, source, startDate, endDate, limit } = req.query;
        const options = {};
        if (isDeducted !== undefined)
            options.isDeducted = isDeducted === 'true';
        if (serviceId)
            options.serviceId = serviceId;
        if (endpointId)
            options.endpointId = endpointId;
        if (source)
            options.source = source;
        if (startDate)
            options.startDate = new Date(startDate);
        if (endDate)
            options.endDate = new Date(endDate);
        if (limit)
            options.limit = parseInt(limit, 10);
        const samples = await errorSampleService_1.errorSampleService.list(tenantId, options);
        res.json({
            success: true,
            data: samples,
        });
    }),
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const sample = await errorSampleService_1.errorSampleService.getById(id);
        if (!sample) {
            throw new errorHandler_1.ApiError('错误样本不存在', 404);
        }
        res.json({
            success: true,
            data: sample,
        });
    }),
    getPendingDeductions: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const pending = await errorSampleService_1.errorSampleService.getPendingDeductions(tenantId);
        res.json({
            success: true,
            count: pending.length,
            data: pending,
        });
    }),
    batchRecordAndDeduct: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { serviceId, endpointId, source, errorType, errorMessage, statusCode, timestamp, durationMs, requestId, userId, metadata, operator } = req.body;
        if (!source) {
            throw new errorHandler_1.ApiError('错误来源必填', 400);
        }
        const results = await errorSampleService_1.errorSampleService.batchRecordAndDeduct(tenantId, serviceId, endpointId, {
            source,
            errorType,
            errorMessage,
            statusCode,
            timestamp: timestamp ? new Date(timestamp) : undefined,
            durationMs,
            requestId,
            userId,
            metadata,
            operator,
        });
        res.json({
            success: true,
            processedSLOs: results.length,
            data: results,
        });
    }),
};
//# sourceMappingURL=errorSampleController.js.map