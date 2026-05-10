"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endpointController = exports.serviceController = void 0;
const serviceService_1 = require("../services/serviceService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.serviceController = {
    create: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { name, description } = req.body;
        if (!name) {
            throw new errorHandler_1.ApiError('服务名称必填', 400);
        }
        const service = await serviceService_1.serviceService.create(tenantId, name, description);
        res.status(201).json({
            success: true,
            data: service,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const services = await serviceService_1.serviceService.list(tenantId);
        res.json({
            success: true,
            data: services,
        });
    }),
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const service = await serviceService_1.serviceService.getById(id);
        if (!service) {
            throw new errorHandler_1.ApiError('服务不存在', 404);
        }
        res.json({
            success: true,
            data: service,
        });
    }),
    update: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { name, description } = req.body;
        const service = await serviceService_1.serviceService.update(id, { name, description });
        res.json({
            success: true,
            data: service,
        });
    }),
    delete: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        await serviceService_1.serviceService.delete(id);
        res.json({
            success: true,
            message: '服务已删除',
        });
    }),
};
exports.endpointController = {
    create: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { serviceId } = req.params;
        const { method, path, description } = req.body;
        if (!method || !path) {
            throw new errorHandler_1.ApiError('HTTP方法和路径必填', 400);
        }
        const endpoint = await serviceService_1.endpointService.create(serviceId, method, path, description);
        res.status(201).json({
            success: true,
            data: endpoint,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { serviceId } = req.params;
        const endpoints = await serviceService_1.endpointService.list(serviceId);
        res.json({
            success: true,
            data: endpoints,
        });
    }),
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const endpoint = await serviceService_1.endpointService.getById(id);
        if (!endpoint) {
            throw new errorHandler_1.ApiError('接口不存在', 404);
        }
        res.json({
            success: true,
            data: endpoint,
        });
    }),
    update: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { method, path, description } = req.body;
        const endpoint = await serviceService_1.endpointService.update(id, { method, path, description });
        res.json({
            success: true,
            data: endpoint,
        });
    }),
    delete: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        await serviceService_1.endpointService.delete(id);
        res.json({
            success: true,
            message: '接口已删除',
        });
    }),
};
//# sourceMappingURL=serviceController.js.map