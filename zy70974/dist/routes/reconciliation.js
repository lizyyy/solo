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
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const fs = __importStar(require("fs"));
const services_1 = require("../services");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
const importService = new services_1.ImportService();
const reconciliationEngine = new services_1.ReconciliationEngine();
const reviewService = new services_1.ReviewService();
const reportService = new services_1.ReportService();
const dataStore = services_1.DataStore.getInstance();
router.post('/import/registrations', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }
        const result = await importService.parseRegistrationCSV(req.file.path);
        dataStore.saveRegistrations(result.data);
        fs.unlinkSync(req.file.path);
        res.json({
            success: result.success,
            message: `成功导入 ${result.validCount} 条报名记录`,
            data: {
                total: result.totalCount,
                valid: result.validCount,
                errors: result.errors,
                warnings: result.warnings,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/import/waitlist', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }
        const result = await importService.parseWaitlistJSON(req.file.path);
        dataStore.saveWaitlist(result.data);
        fs.unlinkSync(req.file.path);
        res.json({
            success: result.success,
            message: `成功导入 ${result.validCount} 条候补记录`,
            data: {
                total: result.totalCount,
                valid: result.validCount,
                errors: result.errors,
                warnings: result.warnings,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/import/checkins', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }
        const result = await importService.parseCheckInCSV(req.file.path);
        dataStore.saveCheckIns(result.data);
        fs.unlinkSync(req.file.path);
        res.json({
            success: result.success,
            message: `成功导入 ${result.validCount} 条签到记录`,
            data: {
                total: result.totalCount,
                valid: result.validCount,
                errors: result.errors,
                warnings: result.warnings,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/import/blacklist', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }
        const result = await importService.parseBlacklistJSON(req.file.path);
        dataStore.saveBlacklist(result.data);
        fs.unlinkSync(req.file.path);
        res.json({
            success: result.success,
            message: `成功导入 ${result.validCount} 条黑名单记录`,
            data: {
                total: result.totalCount,
                valid: result.validCount,
                errors: result.errors,
                warnings: result.warnings,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/process', async (req, res) => {
    try {
        const { batchName, activityType, activityName, operator = 'system', } = req.body;
        if (!batchName || !activityType || !activityName) {
            return res.status(400).json({ error: '缺少必要参数: batchName, activityType, activityName' });
        }
        const registrations = dataStore.getAllRegistrations();
        const waitlist = dataStore.getAllWaitlist();
        const checkIns = dataStore.getAllCheckIns();
        const blacklist = dataStore.getAllBlacklist();
        const { batch, records } = reconciliationEngine.processReconciliation(batchName, activityType, activityName, registrations, waitlist, checkIns, blacklist, operator);
        dataStore.saveReconciliationBatch(batch);
        dataStore.saveReconciliationRecords(records);
        res.json({
            success: true,
            message: '对账处理完成',
            data: {
                batch,
                recordsCount: records.length,
                statistics: batch.statistics,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/batches', (req, res) => {
    try {
        const batches = dataStore.getAllReconciliationBatches();
        res.json({
            success: true,
            data: batches,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/batches/:batchId', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        res.json({
            success: true,
            data: {
                batch,
                records,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/records/:recordId', (req, res) => {
    try {
        const { recordId } = req.params;
        const record = dataStore.getReconciliationRecord(recordId);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        const explanation = reviewService.explainFinalStatus(record);
        const checkInTrace = reviewService.traceCheckInSource(record);
        const auditTrail = reviewService.getAuditTrail(record);
        res.json({
            success: true,
            data: {
                record,
                explanation,
                checkInTrace,
                auditTrail,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/review', (req, res) => {
    try {
        const { recordId, action, reason, operator, updateFields } = req.body;
        if (!recordId || !action || !reason || !operator) {
            return res.status(400).json({ error: '缺少必要参数: recordId, action, reason, operator' });
        }
        const record = dataStore.getReconciliationRecord(recordId);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        const updatedRecord = reviewService.processReviewAction(record, {
            recordId,
            action,
            reason,
            operator,
            updateFields,
        });
        dataStore.updateReconciliationRecord(updatedRecord);
        const batch = dataStore.getReconciliationBatch(updatedRecord.reconciliationBatchId);
        if (batch) {
            const allRecords = dataStore.getReconciliationRecordsByBatch(batch.id);
            const updatedBatch = reconciliationEngine.recalculateStatistics(batch, allRecords);
            dataStore.saveReconciliationBatch(updatedBatch);
        }
        const explanation = reviewService.explainFinalStatus(updatedRecord);
        res.json({
            success: true,
            message: '复核完成',
            data: {
                record: updatedRecord,
                explanation,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/review/batch', (req, res) => {
    try {
        const { recordIds, action, reason, operator } = req.body;
        if (!recordIds || !Array.isArray(recordIds) || !action || !reason || !operator) {
            return res.status(400).json({ error: '缺少必要参数: recordIds(数组), action, reason, operator' });
        }
        const allRecords = dataStore.getAllReconciliationRecords();
        const updatedRecords = reviewService.batchReview(allRecords, recordIds, {
            action,
            reason,
            operator,
        });
        updatedRecords.forEach((r) => dataStore.updateReconciliationRecord(r));
        const updatedBatchIds = new Set(updatedRecords.filter((r) => recordIds.includes(r.id)).map((r) => r.reconciliationBatchId));
        updatedBatchIds.forEach((batchId) => {
            const batch = dataStore.getReconciliationBatch(batchId);
            if (batch) {
                const batchRecords = dataStore.getReconciliationRecordsByBatch(batchId);
                const updatedBatch = reconciliationEngine.recalculateStatistics(batch, batchRecords);
                dataStore.saveReconciliationBatch(updatedBatch);
            }
        });
        res.json({
            success: true,
            message: `批量复核完成，共处理 ${recordIds.length} 条记录`,
            data: {
                updatedCount: recordIds.length,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/report/:batchId/summary', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        const csv = reportService.generateSummaryCSV(batch, records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="对账汇总_${batch.name}.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/report/:batchId/detailed', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        const report = reportService.generateDetailedReport(batch, records);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="对账详情_${batch.name}.txt"`);
        res.send(report);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/report/:batchId/discrepancy', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        const report = reportService.generateDiscrepancyReport(batch, records);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="差异分析_${batch.name}.txt"`);
        res.send(report);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/report/:batchId/audit', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        const csv = reportService.generateAuditTrailCSV(records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="审计追踪_${batch.name}.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/report/:batchId/json', (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = dataStore.getReconciliationBatch(batchId);
        if (!batch) {
            return res.status(404).json({ error: '批次不存在' });
        }
        const records = dataStore.getReconciliationRecordsByBatch(batchId);
        const json = reportService.generateJSONReport(batch, records);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="对账报告_${batch.name}.json"`);
        res.send(json);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/records/:recordId/explain', (req, res) => {
    try {
        const { recordId } = req.params;
        const record = dataStore.getReconciliationRecord(recordId);
        if (!record) {
            return res.status(404).json({ error: '记录不存在' });
        }
        const explanation = reviewService.explainFinalStatus(record);
        const checkInTrace = reviewService.traceCheckInSource(record);
        res.json({
            success: true,
            data: {
                name: record.name,
                phone: record.phone,
                finalStatus: explanation.status,
                finalReason: explanation.reason,
                evidenceChain: explanation.evidence,
                checkInSource: checkInTrace,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/data/imported', (req, res) => {
    try {
        dataStore.clearImportedData();
        res.json({
            success: true,
            message: '已清空所有导入数据',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
