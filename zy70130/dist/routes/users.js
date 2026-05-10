"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userService_1 = require("../services/userService");
const collectionService_1 = require("../services/collectionService");
const transferService_1 = require("../services/transferService");
const auditService_1 = require("../services/auditService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const { name, isVerified } = req.body;
        if (!name) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        const user = userService_1.userService.createUser(name, !!isVerified);
        res.json(user);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:userId', (req, res) => {
    const user = userService_1.userService.getUser(req.params.userId);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
});
router.put('/:userId/verify', (req, res) => {
    try {
        const { isVerified } = req.body;
        if (typeof isVerified !== 'boolean') {
            return res.status(400).json({ error: 'isVerified 必须是布尔值' });
        }
        const user = userService_1.userService.updateVerification(req.params.userId, isVerified);
        res.json(user);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:userId/collections', (req, res) => {
    const collections = collectionService_1.collectionService.getCollectionsByOwner(req.params.userId);
    res.json(collections);
});
router.get('/:userId/transfers', (req, res) => {
    const status = req.query.status;
    const transfers = transferService_1.transferService.getTransfersByUser(req.params.userId, status);
    res.json(transfers);
});
router.get('/:userId/audit', (req, res) => {
    const logs = auditService_1.auditService.getAuditLogsByActor(req.params.userId);
    res.json(logs);
});
router.get('/:userId/freeze-history', (req, res) => {
    const history = auditService_1.auditService.getFreezeHistory(types_1.FreezeType.USER, req.params.userId);
    res.json(history);
});
exports.default = router;
//# sourceMappingURL=users.js.map