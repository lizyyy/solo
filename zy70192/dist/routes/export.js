"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const exportService = __importStar(require("../services/exportService"));
const backgroundTaskService = __importStar(require("../services/backgroundTaskService"));
const router = (0, express_1.Router)();
router.get('/overview', (req, res) => {
    try {
        const overview = exportService.getSystemOverview();
        res.json((0, response_1.successResponse)(overview));
    }
    catch (error) {
        console.error('Get system overview error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取系统概览失败'));
    }
});
router.get('/samples/csv', (req, res) => {
    try {
        const csv = exportService.exportSampleCSV();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=samples-${Date.now()}.csv`);
        res.send('\ufeff' + csv);
    }
    catch (error) {
        console.error('Export samples CSV error:', error);
        res.status(500).json((0, response_1.errorResponse)('导出样品列表失败'));
    }
});
router.get('/samples/:id/report', (req, res) => {
    try {
        const report = exportService.getSampleFullReport(req.params.id);
        res.json((0, response_1.successResponse)(report));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get sample report error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品报告失败'));
    }
});
router.get('/samples/:id/report/csv', (req, res) => {
    try {
        const csv = exportService.exportSampleReportCSV(req.params.id);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=sample-report-${req.params.id}-${Date.now()}.csv`);
        res.send('\ufeff' + csv);
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Export sample report CSV error:', error);
        res.status(500).json((0, response_1.errorResponse)('导出样品报告失败'));
    }
});
router.post('/samples/:id/report/async', (req, res) => {
    try {
        const task = backgroundTaskService.createBackgroundTask('GENERATE_REPORT', { sampleId: req.params.id });
        res.status(202).json((0, response_1.successResponse)(task, '异步报告生成任务已提交'));
    }
    catch (error) {
        console.error('Create async report task error:', error);
        res.status(500).json((0, response_1.errorResponse)('创建异步报告任务失败'));
    }
});
exports.default = router;
