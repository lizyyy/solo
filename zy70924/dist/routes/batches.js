"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const batchService = __importStar(require("../services/batchService"));
const importService = __importStar(require("../services/importService"));
const queryService = __importStar(require("../services/queryService"));
const processingService = __importStar(require("../services/processingService"));
const certificateService = __importStar(require("../services/certificateService"));
const auditService = __importStar(require("../services/auditService"));
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/', async (req, res) => {
    try {
        const batch = await batchService.createBatch(req.body);
        res.status(201).json(batch);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const batches = await batchService.listBatches(req.query);
        res.json(batches);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const batch = await batchService.getBatch(req.params.id);
        if (!batch)
            return res.status(404).json({ error: '批次不存在' });
        res.json(batch);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.put('/:id/status', async (req, res) => {
    try {
        const { status, operator, reason } = req.body;
        await batchService.updateBatchStatus(req.params.id, status, operator, reason);
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/import/attendance', upload.single('file'), async (req, res) => {
    try {
        const { operator } = req.body;
        const csvContent = req.file?.buffer.toString('utf-8') || '';
        const result = await importService.importAttendanceCSV(req.params.id, csvContent, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/import/homework', async (req, res) => {
    try {
        const { homework, operator } = req.body;
        const result = await importService.importHomeworkJSON(req.params.id, homework, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/return', async (req, res) => {
    try {
        const { reason, operator } = req.body;
        await processingService.returnBatchForRevision(req.params.id, reason, operator);
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/:id/certificates/generate', async (req, res) => {
    try {
        const { operator } = req.body;
        const result = await certificateService.generateCertificates(req.params.id, operator);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/attendance-report', async (req, res) => {
    try {
        const report = await queryService.getBatchAttendanceReport(req.params.id);
        res.json(report);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:id/audit-logs', async (req, res) => {
    try {
        const logs = await auditService.getAuditLogs({ batch_id: req.params.id });
        res.json(logs);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
