"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetController = void 0;
const budgetService_1 = require("../services/budgetService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.budgetController = {
    getOrCreate: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { sloConfigId } = req.params;
        const { referenceTime } = req.query;
        const budget = await budgetService_1.budgetService.getOrCreateBudget(sloConfigId, referenceTime ? new Date(referenceTime) : undefined);
        res.json({
            success: true,
            data: budget,
        });
    }),
    deductFromBudget: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { sloConfigId, errorSampleId } = req.params;
        const { reason, metadata, operator } = req.body;
        const result = await budgetService_1.budgetService.deductFromBudget(sloConfigId, errorSampleId, {
            reason,
            metadata,
            operator,
        });
        res.json({
            success: true,
            data: result,
        });
    }),
    getStatus: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { sloConfigId } = req.params;
        const { referenceTime } = req.query;
        const status = await budgetService_1.budgetService.getBudgetStatus(sloConfigId, referenceTime ? new Date(referenceTime) : undefined);
        res.json({
            success: true,
            data: status,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { isFrozen, windowType, limit } = req.query;
        const options = {};
        if (isFrozen !== undefined)
            options.isFrozen = isFrozen === 'true';
        if (windowType)
            options.windowType = windowType;
        if (limit)
            options.limit = parseInt(limit, 10);
        const budgets = await budgetService_1.budgetService.listBudgets(tenantId, options);
        res.json({
            success: true,
            data: budgets,
        });
    }),
};
//# sourceMappingURL=budgetController.js.map