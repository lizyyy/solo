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
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const importService_1 = __importDefault(require("../services/importService"));
const reconciliationEngine_1 = __importDefault(require("../services/reconciliationEngine"));
const reviewService_1 = __importDefault(require("../services/reviewService"));
const reportService_1 = __importDefault(require("../services/reportService"));
const dataStore_1 = __importDefault(require("../store/dataStore"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.post('/import/service-orders', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传CSV文件' });
        }
        const result = await importService_1.default.importServiceOrdersFromCSV(req.file.path);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/import/schedules', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传JSON文件' });
        }
        const result = await importService_1.default.importNurseSchedulesFromJSON(req.file.path);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/import/elders', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传JSON文件' });
        }
        const result = await importService_1.default.importElderProfilesFromJSON(req.file.path);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/reconciliation/start', (req, res) => {
    try {
        const { name, periodStart, periodEnd, createdBy } = req.body;
        if (!name || !periodStart || !periodEnd) {
            return res.status(400).json({ error: '缺少必填参数' });
        }
        const batch = dataStore_1.default.createBatch(name, periodStart, periodEnd, createdBy || 'system');
        const orders = dataStore_1.default.getServiceOrdersByDateRange(periodStart, periodEnd);
        const schedules = dataStore_1.default.getAllSchedules();
        const elders = dataStore_1.default.getAllElders();
        const records = reconciliationEngine_1.default.runReconciliation(batch.id, orders, schedules, elders);
        res.json({
            batchId: batch.id,
            batchName: batch.name,
            totalRecords: records.length,
            matchedCount: records.filter(r => r.status === 'matched').length,
            discrepancyCount: records.filter(r => r.status === 'discrepancy').length,
            records: records.slice(0, 50),
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/reconciliation/batches', (req, res) => {
    try {
        const batches = dataStore_1.default.getAllBatches();
        res.json(batches);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/reconciliation/batch/:batchId', (req, res) => {
    try {
        const batch = dataStore_1.default.getBatch(req.params.batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore_1.default.getRecordsByBatch(req.params.batchId);
        res.json({ batch, records });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/reconciliation/record/:recordId', (req, res) => {
    try {
        const record = dataStore_1.default.getReconciliationRecord(req.params.recordId);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.json(record);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/review/:recordId/approve', (req, res) => {
    try {
        const { operator, remark } = req.body;
        const record = reviewService_1.default.approve(req.params.recordId, operator || 'admin', remark);
        res.json(record);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/review/:recordId/reject', (req, res) => {
    try {
        const { operator, remark } = req.body;
        const record = reviewService_1.default.reject(req.params.recordId, operator || 'admin', remark);
        res.json(record);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/review/:recordId/supplement', (req, res) => {
    try {
        const { operator, remark } = req.body;
        const record = reviewService_1.default.requestSupplement(req.params.recordId, operator || 'admin', remark);
        res.json(record);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/review/batch/approve', (req, res) => {
    try {
        const { recordIds, operator, remark } = req.body;
        if (!recordIds || !Array.isArray(recordIds)) {
            return res.status(400).json({ error: '请提供 recordIds 数组' });
        }
        const result = reviewService_1.default.batchApprove(recordIds, operator || 'admin', remark);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/review/:recordId/audit-trail', (req, res) => {
    try {
        const logs = reviewService_1.default.getRecordAuditTrail(req.params.recordId);
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/review/:recordId/explain', (req, res) => {
    try {
        const explanation = reviewService_1.default.explainDecision(req.params.recordId);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(explanation);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/report/:batchId/summary', (req, res) => {
    try {
        const summary = reportService_1.default.generateSummary(req.params.batchId);
        res.json(summary);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/report/:batchId/details', (req, res) => {
    try {
        const details = reportService_1.default.generateDetails(req.params.batchId);
        res.json(details);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/report/:batchId/export/excel', (req, res) => {
    try {
        const fs = require('fs');
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const outputPath = path.join(exportDir, `report_${req.params.batchId}.xlsx`);
        reportService_1.default.exportToExcel(req.params.batchId, outputPath);
        res.download(outputPath);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/report/:batchId/export/csv', (req, res) => {
    try {
        const fs = require('fs');
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const outputPath = path.join(exportDir, `report_${req.params.batchId}.csv`);
        reportService_1.default.exportToCSV(req.params.batchId, outputPath);
        res.download(outputPath);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/traceability/:recordId', (req, res) => {
    try {
        const chain = reportService_1.default.getTraceability(req.params.recordId);
        res.json(chain);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/traceability/:recordId/full', (req, res) => {
    try {
        const chain = reportService_1.default.getFullTraceabilityChain(req.params.recordId);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(chain);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/data/elders', (req, res) => {
    res.json(dataStore_1.default.getAllElders());
});
router.get('/data/schedules', (req, res) => {
    res.json(dataStore_1.default.getAllSchedules());
});
router.get('/data/orders', (req, res) => {
    res.json(dataStore_1.default.getAllServiceOrders());
});
exports.default = router;
