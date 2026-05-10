"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertSuppressionController = void 0;
const alertSuppressionService_1 = require("../services/alertSuppressionService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.alertSuppressionController = {
    suppress: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId } = req.params;
        const { alertType, reason, expiresAt, operator } = req.body;
        if (!alertType || !reason) {
            throw new errorHandler_1.ApiError('告警类型和原因必填', 400);
        }
        const result = await alertSuppressionService_1.alertSuppressionService.suppressAlert(budgetId, alertType, reason, {
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            operator,
        });
        res.json({
            success: true,
            data: result,
        });
    }),
    unsuppress: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { suppressionId } = req.params;
        const { operator } = req.body;
        const result = await alertSuppressionService_1.alertSuppressionService.unsuppressAlert(suppressionId, {
            operator,
        });
        res.json({
            success: true,
            data: result,
        });
    }),
    list: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { isActive, budgetId, alertType, limit } = req.query;
        const options = {};
        if (isActive !== undefined)
            options.isActive = isActive === 'true';
        if (budgetId)
            options.budgetId = budgetId;
        if (alertType)
            options.alertType = alertType;
        if (limit)
            options.limit = parseInt(limit, 10);
        const suppressions = await alertSuppressionService_1.alertSuppressionService.listSuppressions(tenantId, options);
        res.json({
            success: true,
            data: suppressions,
        });
    }),
    checkSuppressed: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId, alertType } = req.params;
        const isSuppressed = await alertSuppressionService_1.alertSuppressionService.isAlertSuppressed(budgetId, alertType);
        res.json({
            success: true,
            isSuppressed,
        });
    }),
    getActive: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { budgetId } = req.params;
        const suppressions = await alertSuppressionService_1.alertSuppressionService.getActiveSuppressions(budgetId);
        res.json({
            success: true,
            count: suppressions.length,
            data: suppressions,
        });
    }),
};
//# sourceMappingURL=alertSuppressionController.js.map