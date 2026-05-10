"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sloController = void 0;
const enums_1 = require("../types/enums");
const sloService_1 = require("../services/sloService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.sloController = {
    create: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { name, type, targetValue, timeWindowType, serviceId, endpointId, description, operator } = req.body;
        if (!name || !type || !targetValue || !timeWindowType) {
            throw new errorHandler_1.ApiError('SLO名称、类型、目标值和时间窗类型必填', 400);
        }
        if (!enums_1.SLOTypeValues.includes(type)) {
            throw new errorHandler_1.ApiError(`无效的SLO类型，可选值: ${enums_1.SLOTypeValues.join(', ')}`, 400);
        }
        if (!enums_1.TimeWindowTypeValues.includes(timeWindowType)) {
            throw new errorHandler_1.ApiError(`无效的时间窗类型，可选值: ${enums_1.TimeWindowTypeValues.join(', ')}`, 400);
        }
        const sloConfig = await sloService_1.sloService.create(tenantId, name, type, targetValue, timeWindowType, {
            serviceId,
            endpointId,
            description,
            operator,
        });
        res.status(201).json({
            success: true,
            data: sloConfig,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { isActive, serviceId, endpointId } = req.query;
        const options = {};
        if (isActive !== undefined)
            options.isActive = isActive === 'true';
        if (serviceId)
            options.serviceId = serviceId;
        if (endpointId)
            options.endpointId = endpointId;
        const sloConfigs = await sloService_1.sloService.list(tenantId, options);
        res.json({
            success: true,
            data: sloConfigs,
        });
    }),
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const sloConfig = await sloService_1.sloService.getById(id);
        if (!sloConfig) {
            throw new errorHandler_1.ApiError('SLO配置不存在', 404);
        }
        res.json({
            success: true,
            data: sloConfig,
        });
    }),
    update: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { name, targetValue, description, isActive } = req.body;
        const sloConfig = await sloService_1.sloService.update(id, { name, targetValue, description, isActive });
        res.json({
            success: true,
            data: sloConfig,
        });
    }),
    activate: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const sloConfig = await sloService_1.sloService.activate(id);
        res.json({
            success: true,
            data: sloConfig,
        });
    }),
    deactivate: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const sloConfig = await sloService_1.sloService.deactivate(id);
        res.json({
            success: true,
            data: sloConfig,
        });
    }),
    delete: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        await sloService_1.sloService.delete(id);
        res.json({
            success: true,
            message: 'SLO配置已删除',
        });
    }),
};
//# sourceMappingURL=sloController.js.map