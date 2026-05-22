"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TransferService_1 = require("../services/TransferService");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/', async (req, res) => {
    try {
        const { name, branchId, createdBy, description } = req.body;
        const batch = await TransferService_1.transferService.createBatch(name, branchId, createdBy, description);
        res.status(201).json(batch);
    }
    catch (error) {
        res.status(500).json({ error: '创建批次失败' });
    }
});
router.post('/:batchId/upload', upload.single('file'), async (req, res) => {
    try {
        const { batchId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }
        const records = await TransferService_1.transferService.parseCSV(req.file.buffer, batchId);
        await TransferService_1.transferService.addRecordsToBatch(batchId, records);
        res.status(200).json({
            message: `成功导入 ${records.length} 条记录`,
            recordsWithIssues: records.filter(r => r.issues.length > 0).length
        });
    }
    catch (error) {
        res.status(500).json({ error: '导入CSV失败' });
    }
});
router.get('/', async (req, res) => {
    try {
        const batches = await TransferService_1.transferService.getAllBatches();
        res.status(200).json(batches);
    }
    catch (error) {
        res.status(500).json({ error: '获取批次列表失败' });
    }
});
router.get('/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await TransferService_1.transferService.getBatchById(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        res.status(200).json(batch);
    }
    catch (error) {
        res.status(500).json({ error: '获取批次失败' });
    }
});
exports.default = router;
