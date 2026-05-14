"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantInitService_1 = require("../services/tenantInitService");
const rollbackService_1 = require("../services/rollbackService");
const exportService_1 = require("../services/exportService");
const database_1 = require("../database");
const router = (0, express_1.Router)();
router.post('/initialize', async (req, res) => {
    try {
        const { tenantId, tenantName, packagePath } = req.body;
        if (!tenantId || !tenantName || !packagePath) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数: tenantId, tenantName, packagePath'
            });
        }
        const result = await tenantInitService_1.tenantInitService.initializeTenant(tenantId, tenantName, packagePath);
        res.json({
            success: result.success,
            recordId: result.recordId,
            currentStep: result.currentStep,
            error: result.error
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/records', async (req, res) => {
    try {
        const { status, tenantId } = req.query;
        const records = await tenantInitService_1.tenantInitService.getInitRecords({
            status: status,
            tenantId: tenantId
        });
        res.json({
            success: true,
            data: records
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/records/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const record = await tenantInitService_1.tenantInitService.getInitRecord(recordId);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: '记录不存在'
            });
        }
        res.json({
            success: true,
            data: record
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/records/:recordId/details', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { status, step } = req.query;
        const details = await tenantInitService_1.tenantInitService.getDetailItems(recordId, {
            status: status,
            step: step
        });
        res.json({
            success: true,
            data: details
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/records/:recordId/failed', async (req, res) => {
    try {
        const { recordId } = req.params;
        const failedItems = await tenantInitService_1.tenantInitService.getDetailItems(recordId, { status: 'FAILED' });
        res.json({
            success: true,
            data: failedItems
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/rollback/:recordId/candidates', async (req, res) => {
    try {
        const { recordId } = req.params;
        const candidates = await rollbackService_1.rollbackService.generateRollbackCandidates(recordId);
        res.json({
            success: true,
            data: candidates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/rollback/:recordId/candidates', async (req, res) => {
    try {
        const { recordId } = req.params;
        const candidates = await rollbackService_1.rollbackService.getRollbackCandidates(recordId);
        res.json({
            success: true,
            data: candidates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/rollback/:recordId/execute', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { candidateIds } = req.body;
        if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供要回滚的候选ID列表'
            });
        }
        const result = await rollbackService_1.rollbackService.executeRollback(recordId, candidateIds);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/cleanup/candidates', async (req, res) => {
    try {
        const candidates = await rollbackService_1.rollbackService.generateCleanupCandidates();
        res.json({
            success: true,
            data: candidates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/export/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const filePath = await exportService_1.exportService.exportInitRecord(recordId);
        res.json({
            success: true,
            filePath
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/export/devices/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const filePath = await exportService_1.exportService.exportDeviceLedger(tenantId);
        res.json({
            success: true,
            filePath
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/revisions', async (req, res) => {
    try {
        const { recordId, detailItemId, attachmentName, beforeValue, afterValue, modifiedBy, approvalNodeId } = req.body;
        const revisionId = await exportService_1.exportService.createAttachmentRevision(recordId, detailItemId, attachmentName, beforeValue, afterValue, modifiedBy, approvalNodeId);
        res.json({
            success: true,
            revisionId
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/revisions/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const revisions = await exportService_1.exportService.getAttachmentRevisions(recordId);
        res.json({
            success: true,
            data: revisions
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/approvals', async (req, res) => {
    try {
        const { recordId, nodeName, nodeOrder, approver } = req.body;
        const nodeId = await exportService_1.exportService.createApprovalNode(recordId, nodeName, nodeOrder, approver);
        res.json({
            success: true,
            nodeId
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/approvals/:nodeId/approve', async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { approver, comment } = req.body;
        await exportService_1.exportService.approveNode(nodeId, approver, comment);
        res.json({
            success: true
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/approvals/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;
        const nodes = await exportService_1.exportService.getApprovalNodes(recordId);
        res.json({
            success: true,
            data: nodes
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/devices/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const devices = await (0, database_1.allQuery)(`SELECT * FROM device_ledgers WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId]);
        const result = devices.map(d => ({
            id: d.id,
            tenantId: d.tenant_id,
            deviceCode: d.device_code,
            deviceName: d.device_name,
            deviceType: d.device_type,
            storeName: d.store_name,
            installLocation: d.install_location,
            status: d.status,
            purchaseDate: d.purchase_date,
            warrantyPeriod: d.warranty_period,
            manufacturer: d.manufacturer,
            model: d.model
        }));
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
