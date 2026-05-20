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
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationController = void 0;
const path = __importStar(require("path"));
const store_1 = require("../models/store");
const ReconciliationService_1 = require("../services/ReconciliationService");
const ImportService_1 = require("../services/ImportService");
const ReportService_1 = require("../services/ReportService");
class ReconciliationController {
    async createReconciliation(req, res) {
        try {
            const { applicationId } = req.body;
            if (!applicationId) {
                res.status(400).json({ error: '申请ID不能为空' });
                return;
            }
            const record = await ReconciliationService_1.reconciliationService.createReconciliation(applicationId);
            if (!record) {
                res.status(404).json({ error: '未找到对应的摊位申请' });
                return;
            }
            res.json({ success: true, data: record });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async batchCreateReconciliations(req, res) {
        try {
            const records = await ReconciliationService_1.reconciliationService.batchCreateAll();
            res.json({
                success: true,
                count: records.length,
                data: records
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getReconciliation(req, res) {
        try {
            const { id } = req.params;
            const record = store_1.dataStore.getReconciliationRecord(id);
            if (!record) {
                res.status(404).json({ error: '未找到对账记录' });
                return;
            }
            res.json({ success: true, data: record });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getAllReconciliations(req, res) {
        try {
            const records = store_1.dataStore.getAllReconciliationRecords();
            res.json({ success: true, count: records.length, data: records });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async reviewDiscrepancy(req, res) {
        try {
            const { id } = req.params;
            const { discrepancyId, reviewer, result, notes, adjustmentAmount, adjustmentReason } = req.body;
            if (!discrepancyId || !reviewer || !result || !notes) {
                res.status(400).json({ error: '缺少必要参数' });
                return;
            }
            const record = await ReconciliationService_1.reconciliationService.reviewDiscrepancy(id, discrepancyId, reviewer, result, notes, adjustmentAmount, adjustmentReason);
            if (!record) {
                res.status(404).json({ error: '未找到对账记录或差异记录' });
                return;
            }
            res.json({ success: true, data: record });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async completeReconciliation(req, res) {
        try {
            const { id } = req.params;
            const { reviewer } = req.body;
            if (!reviewer) {
                res.status(400).json({ error: '复核人不能为空' });
                return;
            }
            const record = await ReconciliationService_1.reconciliationService.completeReconciliation(id, reviewer);
            if (!record) {
                res.status(404).json({ error: '未找到对账记录' });
                return;
            }
            res.json({ success: true, data: record });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getSummary(req, res) {
        try {
            const summary = ReconciliationService_1.reconciliationService.getSummary();
            res.json({ success: true, data: summary });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async importApplications(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ error: '请提供文件路径' });
                return;
            }
            const result = await ImportService_1.importService.importBoothApplications(filePath);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async importLicenses(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ error: '请提供文件路径' });
                return;
            }
            const result = await ImportService_1.importService.importLicenseAttachments(filePath);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async importVenueCalendar(req, res) {
        try {
            const { filePath } = req.body;
            if (!filePath) {
                res.status(400).json({ error: '请提供文件路径' });
                return;
            }
            const result = await ImportService_1.importService.importVenueCalendar(filePath);
            res.json({ success: true, data: result });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async exportReconciliationCSV(req, res) {
        try {
            const { id } = req.params;
            const record = store_1.dataStore.getReconciliationRecord(id);
            if (!record) {
                res.status(404).json({ error: '未找到对账记录' });
                return;
            }
            const filePath = ReportService_1.reportService.generateReconciliationCSV(record);
            const fileName = path.basename(filePath);
            res.download(filePath, fileName);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async exportReconciliationPDF(req, res) {
        try {
            const { id } = req.params;
            const record = store_1.dataStore.getReconciliationRecord(id);
            if (!record) {
                res.status(404).json({ error: '未找到对账记录' });
                return;
            }
            const filePath = await ReportService_1.reportService.generateReconciliationPDF(record);
            const fileName = path.basename(filePath);
            res.download(filePath, fileName);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async exportSummaryCSV(req, res) {
        try {
            const records = store_1.dataStore.getAllReconciliationRecords();
            const filePath = ReportService_1.reportService.generateDetailedCSV(records);
            const fileName = path.basename(filePath);
            res.download(filePath, fileName);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async exportSummaryPDF(req, res) {
        try {
            const summary = ReconciliationService_1.reconciliationService.getSummary();
            const filePath = await ReportService_1.reportService.generateSummaryPDF(summary);
            const fileName = path.basename(filePath);
            res.download(filePath, fileName);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getAllApplications(req, res) {
        try {
            const applications = store_1.dataStore.getAllBoothApplications();
            res.json({ success: true, count: applications.length, data: applications });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getAllLicenses(req, res) {
        try {
            const licenses = store_1.dataStore.getAllLicenseAttachments();
            res.json({ success: true, count: licenses.length, data: licenses });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getVenueCalendar(req, res) {
        try {
            const calendars = store_1.dataStore.getAllVenueCalendars();
            res.json({ success: true, count: calendars.length, data: calendars });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.reconciliationController = new ReconciliationController();
