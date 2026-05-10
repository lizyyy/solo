"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezeController = void 0;
const enums_1 = require("../types/enums");
const freezeService_1 = require("../services/freezeService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.freezeController = {
    freeze: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId } = req.params;
        const { reason, description, operator } = req.body;
        if (!reason) {
            throw new errorHandler_1.ApiError('冻结原因必填', 400);
        }
        if (!enums_1.FreezeReasonValues.includes(reason)) {
            throw new errorHandler_1.ApiError(`无效的冻结原因，可选值: ${enums_1.FreezeReasonValues.join(', ')}`, 400);
        }
        const result = await freezeService_1.freezeService.freezeBudget(budgetId, reason, {
            description,
            operator,
        });
        res.json({
            success: true,
            data: result,
        });
    }),
    unfreeze: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId } = req.params;
        const { reason, operator } = req.body;
        const result = await freezeService_1.freezeService.unfreezeBudget(budgetId, {
            reason,
            operator,
        });
        res.json({
            success: true,
            data: result,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { isActive, budgetId, limit } = req.query;
        const options = {};
        if (isActive !== undefined)
            options.isActive = isActive === 'true';
        if (budgetId)
            options.budgetId = budgetId;
        if (limit)
            options.limit = parseInt(limit, 10);
        const freezes = await freezeService_1.freezeService.listFreezes(tenantId, options);
        res.json({
            success: true,
            data: freezes,
        });
    }),
    getActive: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId } = req.params;
        const freeze = await freezeService_1.freezeService.getActiveFreeze(budgetId);
        res.json({
            success: true,
            hasActiveFreeze: !!freeze,
            data: freeze,
        });
    }),
};
//# sourceMappingURL=freezeController.js.map