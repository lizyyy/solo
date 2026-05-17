"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const correction_1 = require("../services/correction");
const importExport_1 = require("../services/importExport");
const memory_1 = require("../storage/memory");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/corrections', async (req, res) => {
    try {
        const result = await correction_1.correctionService.createCorrection(req.body);
        const response = {
            code: result.success ? 200 : 400,
            message: result.success ? '创建成功' : '创建失败',
            businessCode: result.businessCode,
            businessMessage: result.businessMessage,
            data: result.record
        };
        res.status(result.success ? 200 : 400).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/corrections', async (req, res) => {
    try {
        const params = {
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
            status: req.query.status,
            sourceSystem: req.query.sourceSystem,
            userId: req.query.userId,
            videoId: req.query.videoId,
            keyword: req.query.keyword
        };
        const result = await memory_1.memoryStorage.listRecords(params);
        const response = {
            code: 200,
            message: '查询成功',
            data: result
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/corrections/:id', async (req, res) => {
    try {
        const record = await correction_1.correctionService.getRecordDetail(req.params.id);
        if (!record) {
            const response = {
                code: 404,
                message: '记录不存在',
                businessCode: 'RECORD_NOT_FOUND',
                businessMessage: '纠偏记录不存在'
            };
            return res.status(404).json(response);
        }
        const response = {
            code: 200,
            message: '查询成功',
            data: record
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/corrections/:id/history', async (req, res) => {
    try {
        const histories = await memory_1.memoryStorage.getHistoriesByRecordId(req.params.id);
        const response = {
            code: 200,
            message: '查询成功',
            data: histories
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.put('/corrections/:id/status', async (req, res) => {
    try {
        const result = await correction_1.correctionService.updateStatus({
            recordId: req.params.id,
            newStatus: req.body.newStatus,
            operatorId: req.body.operatorId,
            operatorName: req.body.operatorName,
            remark: req.body.remark
        });
        const response = {
            code: result.success ? 200 : 400,
            message: result.success ? '状态更新成功' : '状态更新失败',
            businessCode: result.businessCode,
            businessMessage: result.businessMessage,
            data: result.record
        };
        res.status(result.success ? 200 : 400).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.post('/corrections/:id/correct-paid', async (req, res) => {
    try {
        const result = await correction_1.correctionService.correctPaidUser(req.params.id, req.body.operatorId || 'admin', req.body.operatorName || '管理员');
        const response = {
            code: result.success ? 200 : 400,
            message: result.success ? '纠偏成功' : '纠偏失败',
            businessCode: result.businessCode,
            businessMessage: result.businessMessage,
            data: result.record
        };
        res.status(result.success ? 200 : 400).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.post('/import', async (req, res) => {
    try {
        const csvContent = req.body.csvContent;
        if (!csvContent) {
            const response = {
                code: 400,
                message: '请求参数错误',
                businessCode: 'MISSING_CSV_CONTENT',
                businessMessage: '缺少CSV内容'
            };
            return res.status(400).json(response);
        }
        const result = await importExport_1.importExportService.importFromCsv(csvContent);
        const response = {
            code: 200,
            message: '导入完成',
            data: result
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/export', async (req, res) => {
    try {
        const status = req.query.status;
        const sourceSystem = req.query.sourceSystem;
        const csvContent = await importExport_1.importExportService.exportToCsv(status, sourceSystem);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="correction_records_${Date.now()}.csv"`);
        res.send('\uFEFF' + csvContent);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/bad-rows', async (req, res) => {
    try {
        const batchId = req.query.batchId;
        const badRows = await memory_1.memoryStorage.getBadRows(batchId);
        const response = {
            code: 200,
            message: '查询成功',
            data: badRows
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
router.get('/summary', async (_req, res) => {
    try {
        const allRecords = await memory_1.memoryStorage.getAllRecords();
        const statusSummary = {};
        for (const status of Object.values(types_1.CorrectionStatus)) {
            statusSummary[status] = {
                count: allRecords.filter(r => r.status === status).length,
                label: types_1.CorrectionStatusLabel[status]
            };
        }
        const sourceSummary = {};
        for (const record of allRecords) {
            sourceSummary[record.sourceSystem] = (sourceSummary[record.sourceSystem] || 0) + 1;
        }
        const conflictCount = allRecords.filter(r => r.conflictInfo?.hasConflict).length;
        const response = {
            code: 200,
            message: '查询成功',
            data: {
                total: allRecords.length,
                statusSummary,
                sourceSummary,
                conflictCount
            }
        };
        res.json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '服务器内部错误',
            businessCode: 'INTERNAL_ERROR',
            businessMessage: error instanceof Error ? error.message : '未知错误'
        };
        res.status(500).json(response);
    }
});
exports.default = router;
