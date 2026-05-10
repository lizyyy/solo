"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collectionService_1 = require("../services/collectionService");
const transferService_1 = require("../services/transferService");
const auditService_1 = require("../services/auditService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const { name, ownerId } = req.body;
        if (!name || !ownerId) {
            return res.status(400).json({ error: '藏品名称和拥有者ID不能为空' });
        }
        const collection = collectionService_1.collectionService.createCollection(name, ownerId);
        res.json(collection);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:collectionId', (req, res) => {
    const collection = collectionService_1.collectionService.getCollection(req.params.collectionId);
    if (!collection) {
        return res.status(404).json({ error: '藏品不存在' });
    }
    res.json(collection);
});
router.get('/:collectionId/transfers', (req, res) => {
    const transfers = transferService_1.transferService.getTransfersByCollection(req.params.collectionId);
    res.json(transfers);
});
router.get('/:collectionId/freeze-history', (req, res) => {
    const history = auditService_1.auditService.getFreezeHistory(types_1.FreezeType.COLLECTION, req.params.collectionId);
    res.json(history);
});
exports.default = router;
//# sourceMappingURL=collections.js.map