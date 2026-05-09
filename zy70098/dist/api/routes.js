"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
const express_1 = require("express");
const invitationService_1 = require("../services/invitationService");
function createRoutes(db) {
    const router = (0, express_1.Router)();
    const service = new invitationService_1.InvitationService(db);
    router.post('/batches', (req, res) => {
        const input = {
            ...req.body,
            enrollmentStartTime: new Date(req.body.enrollmentStartTime),
            enrollmentEndTime: new Date(req.body.enrollmentEndTime),
            executionStartTime: new Date(req.body.executionStartTime),
            executionEndTime: new Date(req.body.executionEndTime)
        };
        const result = service.createBatch(input, req.headers['x-operator']);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.status(201).json({
            success: true,
            data: result.data,
            events: result.events
        });
    });
    router.get('/batches', (req, res) => {
        const batches = service.getAllBatches();
        res.json({
            success: true,
            data: batches
        });
    });
    router.get('/batches/:batchId', (req, res) => {
        const batch = service.getBatch(req.params.batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: '邀约批次不存在'
                }
            });
        }
        res.json({
            success: true,
            data: batch
        });
    });
    router.post('/batches/:batchId/publish', (req, res) => {
        const result = service.publishBatch(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/start-enrollment', (req, res) => {
        const result = service.startEnrollment(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/close-enrollment', (req, res) => {
        const result = service.closeEnrollment(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/start-execution', (req, res) => {
        const result = service.startExecution(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/complete-execution', (req, res) => {
        const result = service.completeExecution(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/start-settlement', (req, res) => {
        const result = service.startSettlement(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.post('/batches/:batchId/complete-settlement', (req, res) => {
        const result = service.completeSettlement(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.get('/batches/:batchId/summary', (req, res) => {
        const result = service.getBatchSummary(req.params.batchId);
        handleOperationResult(res, result);
    });
    router.get('/batches/:batchId/events', (req, res) => {
        const events = service.getEventsByBatch(req.params.batchId);
        res.json({
            success: true,
            data: events
        });
    });
    router.get('/batches/:batchId/enrollments', (req, res) => {
        const enrollments = service.getEnrollmentsByBatch(req.params.batchId);
        res.json({
            success: true,
            data: enrollments
        });
    });
    router.post('/batches/:batchId/calculate-settlement', (req, res) => {
        const result = service.calculateSettlementForBatch(req.params.batchId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.get('/batches/:batchId/replay', (req, res) => {
        const result = service.replayBatchEvents(req.params.batchId);
        handleOperationResult(res, result);
    });
    router.post('/enrollments', (req, res) => {
        const result = service.createEnrollment(req.body, req.headers['x-operator']);
        if (!result.success) {
            const status = result.error?.code === 'DUPLICATE_ENROLLMENT' ? 409 : 400;
            return res.status(status).json({
                success: false,
                error: result.error
            });
        }
        res.status(201).json({
            success: true,
            data: result.data,
            events: result.events
        });
    });
    router.get('/enrollments/:enrollmentId', (req, res) => {
        const enrollment = service.getEnrollment(req.params.enrollmentId);
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ENROLLMENT_NOT_FOUND',
                    message: '报名记录不存在'
                }
            });
        }
        res.json({
            success: true,
            data: enrollment
        });
    });
    router.post('/enrollments/:enrollmentId/review', (req, res) => {
        const result = service.reviewEnrollment({
            enrollmentId: req.params.enrollmentId,
            approved: req.body.approved,
            reviewComment: req.body.reviewComment,
            operator: req.headers['x-operator']
        });
        handleOperationResult(res, result);
    });
    router.get('/enrollments/:enrollmentId/events', (req, res) => {
        const events = service.getEventsByEnrollment(req.params.enrollmentId);
        res.json({
            success: true,
            data: events
        });
    });
    router.get('/enrollments/:enrollmentId/execution-records', (req, res) => {
        const records = service.getExecutionRecords(req.params.enrollmentId);
        res.json({
            success: true,
            data: records
        });
    });
    router.get('/enrollments/:enrollmentId/deviation', (req, res) => {
        const result = service.calculateDeviationForEnrollment(req.params.enrollmentId);
        handleOperationResult(res, result);
    });
    router.post('/enrollments/:enrollmentId/calculate-settlement', (req, res) => {
        const result = service.calculateSettlementForEnrollment(req.params.enrollmentId, req.headers['x-operator']);
        handleOperationResult(res, result);
    });
    router.get('/enrollments/:enrollmentId/settlement', (req, res) => {
        const settlement = service.getSettlementResult(req.params.enrollmentId);
        if (!settlement) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SETTLEMENT_NOT_FOUND',
                    message: '结算记录不存在'
                }
            });
        }
        res.json({
            success: true,
            data: settlement
        });
    });
    router.post('/execution-records', (req, res) => {
        const input = {
            ...req.body,
            timestamp: new Date(req.body.timestamp)
        };
        const result = service.submitExecutionRecord(input, req.headers['x-operator']);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.status(201).json({
            success: true,
            data: result.data,
            events: result.events
        });
    });
    function handleOperationResult(res, result) {
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        res.json({
            success: true,
            data: result.data,
            events: result.events
        });
    }
    return router;
}
//# sourceMappingURL=routes.js.map