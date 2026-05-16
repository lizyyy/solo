"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CancelRequestService_1 = require("../services/CancelRequestService");
const ExportService_1 = require("../services/ExportService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const request = req.body;
        if (!request.jobId || !request.jobName) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'jobId and jobName are required'
            });
        }
        if (!Array.isArray(request.tasks) || request.tasks.length === 0) {
            return res.status(400).json({
                error: 'Missing tasks',
                message: 'At least one task is required'
            });
        }
        if (!request.reason || !request.reason.operator) {
            return res.status(400).json({
                error: 'Missing reason',
                message: 'reason with operator is required'
            });
        }
        if (!Object.values(types_1.RetainResultPolicy).includes(request.retainResultPolicy)) {
            return res.status(400).json({
                error: 'Invalid retainResultPolicy',
                message: `Must be one of: ${Object.values(types_1.RetainResultPolicy).join(', ')}`
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.createCancelRequest(request);
        res.status(201).json({
            message: 'Cancel request created successfully',
            requestId: result.requestId,
            status: result.status,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const request = await CancelRequestService_1.cancelRequestService.getCancelRequest(requestId);
        if (!request) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            data: request
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/', async (req, res) => {
    try {
        const params = {
            jobId: req.query.jobId,
            status: req.query.status,
            operator: req.query.operator,
            page: req.query.page ? parseInt(req.query.page) : 1,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : 20
        };
        if (req.query.startTime) {
            params.startTime = new Date(req.query.startTime);
        }
        if (req.query.endTime) {
            params.endTime = new Date(req.query.endTime);
        }
        if (params.status && !Object.values(types_1.CancelRequestStatus).includes(params.status)) {
            return res.status(400).json({
                error: 'Invalid status',
                message: `Must be one of: ${Object.values(types_1.CancelRequestStatus).join(', ')}`
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.queryCancelRequests(params);
        res.json({
            data: result.data,
            pagination: {
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
                totalPages: Math.ceil(result.total / result.pageSize)
            }
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.patch('/:requestId/status', async (req, res) => {
    try {
        const { requestId } = req.params;
        const updateRequest = req.body;
        if (!updateRequest.status) {
            return res.status(400).json({
                error: 'Missing status',
                message: 'status is required'
            });
        }
        if (!Object.values(types_1.CancelRequestStatus).includes(updateRequest.status)) {
            return res.status(400).json({
                error: 'Invalid status',
                message: `Must be one of: ${Object.values(types_1.CancelRequestStatus).join(', ')}`
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.updateStatus(requestId, updateRequest);
        if (!result) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            message: 'Status updated successfully',
            data: result
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Invalid status transition')) {
            return res.status(400).json({
                error: 'Invalid status transition',
                message: error.message
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:requestId/confirm', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { operator } = req.body;
        if (!operator) {
            return res.status(400).json({
                error: 'Missing operator',
                message: 'operator is required'
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.confirmCancelRequest(requestId, operator);
        if (!result) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            message: 'Cancel request confirmed successfully',
            data: result
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Only pending requests')) {
            return res.status(400).json({
                error: 'Invalid operation',
                message: error.message
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:requestId/process', async (req, res) => {
    try {
        const { requestId } = req.params;
        const result = await CancelRequestService_1.cancelRequestService.processCancelRequest(requestId);
        if (!result) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            message: 'Cancel request processed successfully',
            data: result
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Only confirmed requests')) {
            return res.status(400).json({
                error: 'Invalid operation',
                message: error.message
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:requestId/manual-correction', async (req, res) => {
    try {
        const { requestId } = req.params;
        const correction = req.body;
        if (!correction.taskId || !correction.newStatus || !correction.operator) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'taskId, newStatus, and operator are required'
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.manualCorrection(requestId, correction);
        if (!result) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            message: 'Manual correction applied successfully',
            data: result
        });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('Task not found')) {
            return res.status(404).json({
                error: 'Not found',
                message: error.message
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:requestId/notes', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { operator, note } = req.body;
        if (!operator || !note) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'operator and note are required'
            });
        }
        const result = await CancelRequestService_1.cancelRequestService.addOperatorNote(requestId, operator, note);
        if (!result) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        res.json({
            message: 'Note added successfully',
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:requestId/export', async (req, res) => {
    try {
        const { requestId } = req.params;
        const format = req.query.format || 'json';
        if (format !== 'json' && format !== 'csv') {
            return res.status(400).json({
                error: 'Invalid format',
                message: 'format must be either "json" or "csv"'
            });
        }
        const content = await ExportService_1.exportService.exportFullRequest(requestId, format);
        if (!content) {
            return res.status(404).json({
                error: 'Not found',
                message: `Cancel request ${requestId} not found`
            });
        }
        const filename = ExportService_1.exportService.getExportFilename(requestId, format, 'full');
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.send(content);
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:requestId/reports/:reportId/export', async (req, res) => {
    try {
        const { requestId, reportId } = req.params;
        const format = req.query.format || 'json';
        if (format !== 'json' && format !== 'csv') {
            return res.status(400).json({
                error: 'Invalid format',
                message: 'format must be either "json" or "csv"'
            });
        }
        const content = await ExportService_1.exportService.exportReport(requestId, reportId, format);
        if (!content) {
            return res.status(404).json({
                error: 'Not found',
                message: `Report ${reportId} for request ${requestId} not found`
            });
        }
        const filename = ExportService_1.exportService.getExportFilename(requestId, format, 'report');
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.send(content);
    }
    catch (error) {
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=cancelRequest.js.map