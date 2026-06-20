"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const recordService_1 = require("./services/recordService");
const selfCheckService_1 = require("./services/selfCheckService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.get('/records', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const status = req.query.status;
    const keyword = req.query.keyword;
    const result = (0, recordService_1.getRecords)({ page, pageSize, status, keyword });
    res.json(result);
});
router.get('/records/:id', (req, res) => {
    const record = (0, recordService_1.getRecordById)(req.params.id);
    if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
    }
    res.json(record);
});
router.post('/records', (req, res) => {
    const record = (0, recordService_1.createRecord)(req.body);
    res.status(201).json(record);
});
router.put('/records/:id', (req, res) => {
    const record = (0, recordService_1.updateRecord)(req.params.id, req.body);
    if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
    }
    res.json(record);
});
router.post('/records/:id/confirm', (req, res) => {
    const record = (0, recordService_1.confirmRecord)(req.params.id);
    if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
    }
    res.json(record);
});
router.post('/records/:id/reject', (req, res) => {
    const record = (0, recordService_1.rejectRecord)(req.params.id);
    if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
    }
    res.json(record);
});
router.post('/records/:id/algorithm-review', (req, res) => {
    const record = (0, recordService_1.sendToAlgorithmReview)(req.params.id);
    if (!record) {
        res.status(404).json({ error: '记录不存在' });
        return;
    }
    res.json(record);
});
router.get('/conflicts', (req, res) => {
    const conflicts = (0, recordService_1.getConflicts)();
    res.json(conflicts);
});
router.post('/import', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: '请上传文件' });
        return;
    }
    const result = (0, recordService_1.importFromExcel)(req.file.buffer, req.file.originalname);
    res.json(result);
});
router.get('/export', (req, res) => {
    const idsParam = req.query.ids;
    const recordIds = idsParam ? idsParam.split(',') : undefined;
    const buffer = (0, recordService_1.exportRecords)(recordIds);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="interception_records_${Date.now()}.xlsx"`);
    res.send(buffer);
});
router.post('/self-check/run', (req, res) => {
    const results = (0, selfCheckService_1.runSelfCheck)();
    res.json({ results, count: results.length });
});
router.get('/self-check', (req, res) => {
    const onlyUnresolved = req.query.all ? false : true;
    const results = (0, selfCheckService_1.getSelfCheckResults)(onlyUnresolved);
    res.json(results);
});
router.post('/self-check/:id/resolve', (req, res) => {
    (0, selfCheckService_1.resolveSelfCheck)(req.params.id);
    res.json({ success: true });
});
exports.default = router;
