"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auditService_1 = require("../services/auditService");
const userService_1 = require("../services/userService");
const collectionService_1 = require("../services/collectionService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/freeze/user', (req, res) => {
    try {
        const { userId, reason, adminId } = req.body;
        if (!userId || !reason || !adminId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        userService_1.userService.freezeUser(userId);
        const freeze = auditService_1.auditService.freezeTarget(types_1.FreezeType.USER, userId, reason, adminId);
        res.json(freeze);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/unfreeze/user', (req, res) => {
    try {
        const { userId, adminId } = req.body;
        if (!userId || !adminId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        userService_1.userService.unfreezeUser(userId);
        const freeze = auditService_1.auditService.unfreezeTarget(types_1.FreezeType.USER, userId, adminId);
        res.json(freeze);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/freeze/collection', (req, res) => {
    try {
        const { collectionId, reason, adminId } = req.body;
        if (!collectionId || !reason || !adminId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        collectionService_1.collectionService.freezeCollection(collectionId);
        const freeze = auditService_1.auditService.freezeTarget(types_1.FreezeType.COLLECTION, collectionId, reason, adminId);
        res.json(freeze);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/unfreeze/collection', (req, res) => {
    try {
        const { collectionId, adminId } = req.body;
        if (!collectionId || !adminId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        collectionService_1.collectionService.unfreezeCollection(collectionId);
        const freeze = auditService_1.auditService.unfreezeTarget(types_1.FreezeType.COLLECTION, collectionId, adminId);
        res.json(freeze);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/audit/:targetType/:targetId', (req, res) => {
    const logs = auditService_1.auditService.getAuditLogsByTarget(req.params.targetType, req.params.targetId);
    res.json(logs);
});
router.get('/audit/action/:action', (req, res) => {
    const logs = auditService_1.auditService.getAuditLogsByAction(req.params.action);
    res.json(logs);
});
exports.default = router;
//# sourceMappingURL=admin.js.map