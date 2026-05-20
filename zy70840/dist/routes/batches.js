"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const BatchService_1 = __importDefault(require("../services/BatchService"));
const CsvImportService_1 = __importDefault(require("../services/CsvImportService"));
const ApplicationService_1 = __importDefault(require("../services/ApplicationService"));
const Batch_1 = require("../models/Batch");
const request_1 = require("../utils/request");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/', async (req, res) => {
    try {
        const { name, importedBy, remark } = req.body;
        if (!name || !importedBy) {
            return res.status(400).json({ error: '批次名称和导入人不能为空' });
        }
        const batch = await BatchService_1.default.createBatch(name, importedBy, remark);
        res.json(batch);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const page = (0, request_1.getQueryNumber)(req.query.page) || 1;
        const pageSize = (0, request_1.getQueryNumber)(req.query.pageSize) || 20;
        const status = (0, request_1.getQueryString)(req.query.status);
        const result = await BatchService_1.default.listBatches(page, pageSize, status);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const batch = await BatchService_1.default.getBatchById(parseInt((0, request_1.getParamString)(req.params.id)));
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        res.json(batch);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/:id/import', upload.single('file'), async (req, res) => {
    try {
        const batchId = parseInt((0, request_1.getParamString)(req.params.id));
        const operator = req.body.operator || 'system';
        if (!req.file) {
            return res.status(400).json({ error: '请上传CSV文件' });
        }
        const result = await CsvImportService_1.default.importFromBuffer(batchId, req.file.buffer, operator);
        await BatchService_1.default.updateBatchStatus(batchId, Batch_1.BatchStatus.PROCESSING);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/:id/applications', async (req, res) => {
    try {
        const batchId = parseInt((0, request_1.getParamString)(req.params.id));
        const page = (0, request_1.getQueryNumber)(req.query.page) || 1;
        const pageSize = (0, request_1.getQueryNumber)(req.query.pageSize) || 20;
        const result = await ApplicationService_1.default.listApplications(page, pageSize, { batchId });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const batch = await BatchService_1.default.updateBatchStatus(parseInt((0, request_1.getParamString)(req.params.id)), status);
        res.json(batch);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
