"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const ProcessingService_1 = require("../services/ProcessingService");
const FileParserService_1 = require("../services/FileParserService");
const DataStore_1 = require("../store/DataStore");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '研究生院招生数据处理API运行正常' });
});
router.post('/import/batch', upload.fields([
    { name: 'mentors', maxCount: 1 },
    { name: 'applications', maxCount: 1 },
    { name: 'transfers', maxCount: 1 }
]), async (req, res) => {
    try {
        const batchId = req.body.batchId || `batch_${Date.now()}`;
        if (DataStore_1.dataStore.isBatchProcessed(batchId)) {
            return res.status(400).json({
                error: '批次重复',
                message: `批次 ${batchId} 已处理过，不能重复导入`
            });
        }
        let mentors, applications, transfers;
        const files = req.files;
        if (files.mentors && files.mentors[0]) {
            mentors = await FileParserService_1.fileParserService.parseMentorCSV(files.mentors[0].buffer);
        }
        if (files.applications && files.applications[0]) {
            applications = FileParserService_1.fileParserService.parseApplicationsJSON(files.applications[0].buffer.toString('utf-8'));
        }
        if (files.transfers && files.transfers[0]) {
            transfers = FileParserService_1.fileParserService.parseTransfersJSON(files.transfers[0].buffer.toString('utf-8'));
        }
        if (req.body.mentorsJson) {
            mentors = FileParserService_1.fileParserService.parseApplicationsJSON(req.body.mentorsJson);
        }
        if (req.body.applicationsJson) {
            applications = FileParserService_1.fileParserService.parseApplicationsJSON(req.body.applicationsJson);
        }
        if (req.body.transfersJson) {
            transfers = FileParserService_1.fileParserService.parseTransfersJSON(req.body.transfersJson);
        }
        const result = ProcessingService_1.processingService.processBatch(batchId, mentors, applications, transfers);
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
router.get('/mentors', (req, res) => {
    res.json({
        success: true,
        data: DataStore_1.dataStore.getAllMentors()
    });
});
router.get('/applications', (req, res) => {
    const { status, studentId } = req.query;
    let apps = DataStore_1.dataStore.getAllApplications();
    if (status) {
        apps = apps.filter(a => a.status === status);
    }
    if (studentId) {
        apps = DataStore_1.dataStore.getApplicationsByStudent(studentId);
    }
    res.json({
        success: true,
        data: apps
    });
});
router.get('/transfers', (req, res) => {
    res.json({
        success: true,
        data: DataStore_1.dataStore.getAllTransfers()
    });
});
router.post('/applications/:id/confirm', (req, res) => {
    try {
        const app = ProcessingService_1.processingService.confirmApplication(req.params.id);
        res.json({
            success: true,
            data: app
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/statistics', (req, res) => {
    res.json({
        success: true,
        data: ProcessingService_1.processingService.getStatistics()
    });
});
router.get('/export/mentors', (req, res) => {
    const csv = FileParserService_1.fileParserService.formatMentorCSV();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=mentors.csv');
    res.send(csv);
});
router.post('/reset', (req, res) => {
    DataStore_1.dataStore.reset();
    res.json({
        success: true,
        message: '所有数据已重置'
    });
});
exports.default = router;
