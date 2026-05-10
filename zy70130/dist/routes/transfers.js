"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transferService_1 = require("../services/transferService");
const auditService_1 = require("../services/auditService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const { collectionId, fromUserId, toUserId, requestId } = req.body;
        if (!collectionId || !fromUserId || !toUserId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        const transfer = transferService_1.transferService.createTransfer({
            collectionId,
            fromUserId,
            toUserId,
            requestId,
        });
        res.json(transfer);
    }
    catch (error) {
        const riskCheck = error.riskCheck;
        res.status(400).json({
            error: error.message,
            riskCheck,
        });
    }
});
router.get('/:transferId', (req, res) => {
    const detail = transferService_1.transferService.getTransferDetail(req.params.transferId);
    if (!detail) {
        return res.status(404).json({ error: '转赠记录不存在' });
    }
    res.json(detail);
});
router.post('/:transferId/approve', (req, res) => {
    try {
        const { operatorId } = req.body;
        if (!operatorId) {
            return res.status(400).json({ error: '缺少操作者ID' });
        }
        const transfer = transferService_1.transferService.approveTransfer(req.params.transferId, operatorId);
        res.json(transfer);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:transferId/cancel', (req, res) => {
    try {
        const { operatorId } = req.body;
        if (!operatorId) {
            return res.status(400).json({ error: '缺少操作者ID' });
        }
        const transfer = transferService_1.transferService.cancelTransfer(req.params.transferId, operatorId);
        res.json(transfer);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:transferId/revoke', (req, res) => {
    try {
        const { adminId, reason } = req.body;
        if (!adminId || !reason) {
            return res.status(400).json({ error: '缺少管理员ID或撤销原因' });
        }
        const transfer = transferService_1.transferService.revokeTransfer(req.params.transferId, adminId, reason);
        res.json(transfer);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.put('/:transferId/status', (req, res) => {
    try {
        const { newStatus, adminId, reason } = req.body;
        if (!newStatus || !adminId || !reason) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        const validStatuses = Object.values(types_1.TransferStatus);
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ error: '无效的状态值' });
        }
        const transfer = transferService_1.transferService.manualCorrectTransfer(req.params.transferId, newStatus, adminId, reason);
        res.json(transfer);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:transferId/audit', (req, res) => {
    const logs = auditService_1.auditService.getAuditLogsByTarget('transfer', req.params.transferId);
    res.json(logs);
});
exports.default = router;
//# sourceMappingURL=transfers.js.map