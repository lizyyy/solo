"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportController = void 0;
const reportService_1 = require("../services/reportService");
const errorHandler_1 = require("../middleware/errorHandler");
exports.reportController = {
    generateBudgetReport: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { startDate, endDate, limit } = req.query;
        const options = {};
        if (startDate)
            options.startDate = new Date(startDate);
        if (endDate)
            options.endDate = new Date(endDate);
        if (limit)
            options.limit = parseInt(limit, 10);
        const report = await reportService_1.reportService.generateBudgetReport(tenantId, options);
        res.json({
            success: true,
            data: report,
        });
    }),
    getErrorTrend: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const { days, serviceId, endpointId } = req.query;
        const options = {};
        if (days)
            options.days = parseInt(days, 10);
        if (serviceId)
            options.serviceId = serviceId;
        if (endpointId)
            options.endpointId = endpointId;
        const trend = await reportService_1.reportService.getErrorTrend(tenantId, options);
        res.json({
            success: true,
            data: trend,
        });
    }),
    getSLOCompliance: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId, sloConfigId } = req.params;
        const compliance = await reportService_1.reportService.getSLOCompliance(tenantId, sloConfigId);
        res.json({
            success: true,
            data: compliance,
        });
    }),
    getProcessBlockers: (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
        const { tenantId } = req.params;
        const blockers = await reportService_1.reportService.getProcessBlockers(tenantId);
        res.json({
            success: true,
            data: blockers,
        });
    }),
};
//# sourceMappingURL=reportController.js.map