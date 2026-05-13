"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const revokeService_1 = require("../services/revokeService");
const memoryStore_1 = require("../store/memoryStore");
const importService_1 = require("../services/importService");
const router = (0, express_1.Router)();
router.post('/batches/:batchId/revoke', (req, res) => {
    try {
        const { batchId } = req.params;
        const { force } = req.body;
        const result = revokeService_1.revokeService.revokeBatch(batchId, !!force);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '撤销批次失败'
        });
    }
});
router.post('/batches/:batchId/revoke/:email', (req, res) => {
    try {
        const { batchId, email } = req.params;
        const result = revokeService_1.revokeService.revokeSingleUser(batchId, decodeURIComponent(email));
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '撤销单个用户失败'
        });
    }
});
router.get('/batches/:batchId/can-revoke', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = importService_1.importService.getBatch(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                error: '批次不存在'
            });
        }
        const records = memoryStore_1.store.getRecordsByBatchId(batchId);
        const revokeStatuses = records.map(record => {
            const check = revokeService_1.revokeService.canRevokeRecord(record);
            return {
                email: record.email,
                canRevoke: check.canRevoke,
                reason: check.reason,
                status: record.status,
                isPreExisting: record.isPreExisting
            };
        });
        const summary = {
            total: records.length,
            canRevoke: revokeStatuses.filter(r => r.canRevoke).length,
            cannotRevoke: revokeStatuses.filter(r => !r.canRevoke).length,
            preExistingUsers: records.filter(r => r.isPreExisting).length
        };
        res.json({
            success: true,
            data: {
                summary,
                details: revokeStatuses
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '检查可撤销状态失败'
        });
    }
});
exports.default = router;
