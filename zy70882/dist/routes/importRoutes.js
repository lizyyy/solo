"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const dataImportService_1 = require("../services/dataImportService");
const moment_1 = __importDefault(require("moment"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/meter', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '请上传CSV文件' });
        }
        const result = await dataImportService_1.dataImportService.importMeterData(req.file.buffer, req.file.originalname);
        res.json({
            success: true,
            imported: result.imported,
            errors: result.errors
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/contract', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '请上传JSON文件' });
        }
        const contract = await dataImportService_1.dataImportService.importContract(req.file.buffer);
        res.json({
            success: true,
            data: contract
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/zones', async (req, res) => {
    try {
        const zonesData = req.body;
        if (!Array.isArray(zonesData)) {
            return res.status(400).json({ success: false, error: '温区数据必须是数组' });
        }
        const zones = await dataImportService_1.dataImportService.importZones(zonesData);
        res.json({
            success: true,
            data: zones
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/multiplier-changes', async (req, res) => {
    try {
        const changesData = req.body;
        if (!Array.isArray(changesData)) {
            return res.status(400).json({ success: false, error: '倍率变更数据必须是数组' });
        }
        const changes = await dataImportService_1.dataImportService.importMultiplierChanges(changesData);
        res.json({
            success: true,
            data: changes
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/summary', async (req, res) => {
    try {
        const { periodStart, periodEnd } = req.query;
        if (!periodStart || !periodEnd) {
            return res.status(400).json({ success: false, error: '请提供计费周期参数' });
        }
        const summary = await dataImportService_1.dataImportService.getImportSummary((0, moment_1.default)(periodStart).toDate(), (0, moment_1.default)(periodEnd).toDate());
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=importRoutes.js.map