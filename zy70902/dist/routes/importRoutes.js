"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const importService_1 = require("../services/importService");
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
router.post('/batch', upload.fields([
    { name: 'maintenance', maxCount: 1 },
    { name: 'sensor', maxCount: 1 },
    { name: 'approval', maxCount: 1 },
]), async (req, res) => {
    try {
        const files = req.files;
        const result = await importService_1.importService.batchImport(files.maintenance?.[0]?.buffer, files.sensor?.[0]?.buffer, files.approval?.[0]?.buffer);
        res.json({
            success: true,
            data: result,
            message: '批量导入成功',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '导入失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/maintenance', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未上传文件' });
        }
        const records = await importService_1.importService.parseMaintenanceCsvBuffer(req.file.buffer);
        res.json({
            success: true,
            data: records,
            message: `成功导入 ${records.length} 条检修记录`,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '导入检修记录失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/sensor', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未上传文件' });
        }
        const records = await importService_1.importService.parseSensorJsonBuffer(req.file.buffer);
        res.json({
            success: true,
            data: records,
            message: `成功导入 ${records.length} 条传感器数据`,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '导入传感器数据失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/approval', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未上传文件' });
        }
        const records = await importService_1.importService.parseApprovalCsvBuffer(req.file.buffer);
        res.json({
            success: true,
            data: records,
            message: `成功导入 ${records.length} 条审批记录`,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '导入审批记录失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
exports.default = router;
//# sourceMappingURL=importRoutes.js.map