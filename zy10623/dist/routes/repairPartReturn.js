"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const repairPartReturn_1 = require("../services/repairPartReturn");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.create(req.body);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'IDEMPOTENT_CONFLICT') {
            res.json((0, response_1.createErrorResponse)('409', result.message, response_1.BusinessErrorCode.IDEMPOTENT_CONFLICT, undefined, result.data));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status;
        const result = await repairPartReturn_1.repairPartReturnService.list(page, pageSize, status);
        res.json((0, response_1.createSuccessResponse)(result.data, result.message));
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.get('/export', async (req, res) => {
    try {
        const status = req.query.status;
        const result = await repairPartReturn_1.repairPartReturnService.exportCsv(status);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="repair_part_return_${Date.now()}.csv"`);
        res.send(result.data);
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.getById(req.params.id);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.get('/returnNo/:returnNo', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.getByReturnNo(req.params.returnNo);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.get('/:id/histories', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.getHistories(req.params.id);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.post('/:id/ship', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.ship(req.params.id, req.body);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'INVALID_STATUS_TRANSITION') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION));
        }
        else if (result.code === 'RECORD_NOT_FOUND') {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.post('/:id/receive', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.receive(req.params.id, req.body);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'INVALID_STATUS_TRANSITION') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION));
        }
        else if (result.code === 'RECORD_NOT_FOUND') {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.post('/:id/inspect', async (req, res) => {
    try {
        const stockRecovered = req.query.stockRecovered === 'true';
        const result = await repairPartReturn_1.repairPartReturnService.inspect(req.params.id, req.body, stockRecovered);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'STOCK_RECOVERED_BLOCKED') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR, result.nextStepHint, result.data));
        }
        else if (result.code === 'INVALID_STATUS_TRANSITION') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION));
        }
        else if (result.code === 'RECORD_NOT_FOUND') {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.post('/:id/stockIn', async (req, res) => {
    try {
        const result = await repairPartReturn_1.repairPartReturnService.stockIn(req.params.id, req.body);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'INVALID_STATUS_TRANSITION') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION));
        }
        else if (result.code === 'RECORD_NOT_FOUND') {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const { operatorId, operatorName, remark } = req.body;
        const result = await repairPartReturn_1.repairPartReturnService.reject(req.params.id, operatorId, operatorName, remark);
        if (result.success) {
            res.json((0, response_1.createSuccessResponse)(result.data, result.message));
        }
        else if (result.code === 'INVALID_STATUS_TRANSITION') {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.INVALID_STATUS_TRANSITION));
        }
        else if (result.code === 'RECORD_NOT_FOUND') {
            res.json((0, response_1.createErrorResponse)('404', result.message, response_1.BusinessErrorCode.RECORD_NOT_FOUND));
        }
        else {
            res.json((0, response_1.createErrorResponse)('400', result.message, response_1.BusinessErrorCode.VALIDATION_ERROR));
        }
    }
    catch (error) {
        res.status(500).json((0, response_1.createErrorResponse)('500', '服务器内部错误'));
    }
});
exports.default = router;
