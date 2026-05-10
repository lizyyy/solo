"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantController = void 0;
const tenantService_1 = require("../services/tenantService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.tenantController = {
    create: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { name, description } = req.body;
        if (!name) {
            throw new errorHandler_1.ApiError('租户名称必填', 400);
        }
        const tenant = await tenantService_1.tenantService.create(name, description);
        res.status(201).json({
            success: true,
            data: tenant,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const tenants = await tenantService_1.tenantService.list();
        res.json({
            success: true,
            data: tenants,
        });
    }),
    getById: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const tenant = await tenantService_1.tenantService.getById(id);
        if (!tenant) {
            throw new errorHandler_1.ApiError('租户不存在', 404);
        }
        res.json({
            success: true,
            data: tenant,
        });
    }),
    update: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { name, description } = req.body;
        const tenant = await tenantService_1.tenantService.update(id, { name, description });
        res.json({
            success: true,
            data: tenant,
        });
    }),
    delete: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        await tenantService_1.tenantService.delete(id);
        res.json({
            success: true,
            message: '租户已删除',
        });
    }),
};
//# sourceMappingURL=tenantController.js.map