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
const ticketScanService = __importStar(require("../services/ticketScan.service"));
const csv_writer_1 = require("csv-writer");
const router = (0, express_1.Router)();
router.post('/', async (req, res, next) => {
    try {
        const request = req.body;
        const result = await ticketScanService.createScanRequest(request);
        res.status(201).json({
            success: true,
            data: result,
            message: '扫描请求创建成功'
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await ticketScanService.getScanRecordById(id);
        if (!result) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: '扫描记录不存在',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/ticket/:ticketId', async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const result = await ticketScanService.getScanRecordsByTicketId(ticketId);
        res.json({
            success: true,
            data: result,
            total: result.length
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const result = await ticketScanService.getAllScanRecords(page, pageSize);
        res.json({
            success: true,
            data: result.records,
            pagination: {
                page,
                pageSize,
                total: result.total
            }
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/status/:status', async (req, res, next) => {
    try {
        const { status } = req.params;
        const result = await ticketScanService.getScanRecordsByStatus(status);
        res.json({
            success: true,
            data: result,
            total: result.length
        });
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = await ticketScanService.updateScanStatus(id, request);
        if (!result) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: '扫描记录不存在',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: result,
            message: '状态更新成功'
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/failure', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { errorMessage, rawInput } = req.body;
        const result = await ticketScanService.handleScanFailure(id, errorMessage, rawInput);
        if (!result) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: '扫描记录不存在',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: result,
            message: '异常处理完成，已转入人工审核'
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/manual-correction', async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = await ticketScanService.manualCorrection(id, request);
        if (!result) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: '扫描记录不存在',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: result,
            message: '人工修正完成'
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/export/csv', async (req, res, next) => {
    try {
        const { ticketId, status, startDate, endDate } = req.query;
        const records = await ticketScanService.exportScanRecords({
            ticketId: ticketId,
            status: status,
            startDate: startDate,
            endDate: endDate
        });
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: 'id', title: '记录ID' },
                { id: 'ticketId', title: '工单编号' },
                { id: 'scanEngine', title: '扫描引擎' },
                { id: 'riskLevel', title: '风险等级' },
                { id: 'isolationAction', title: '隔离动作' },
                { id: 'status', title: '状态' },
                { id: 'processingSummary', title: '处理摘要' },
                { id: 'createdAt', title: '创建时间' },
                { id: 'updatedAt', title: '更新时间' }
            ]
        });
        const csvData = records.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
        }));
        const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="ticket-scan-export-${Date.now()}.csv"`);
        res.send('\uFEFF' + csvContent);
    }
    catch (err) {
        next(err);
    }
});
router.get('/export/summary', async (req, res, next) => {
    try {
        const { ticketId, status, startDate, endDate } = req.query;
        const records = await ticketScanService.exportScanRecords({
            ticketId: ticketId,
            status: status,
            startDate: startDate,
            endDate: endDate
        });
        const summary = ticketScanService.generateExportSummary(records);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(summary);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
