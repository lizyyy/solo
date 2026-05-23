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
const express_1 = require("express");
const settlementService = __importStar(require("../services/settlementService"));
const settlementDao = __importStar(require("../dao/settlementDao"));
const exportService = __importStar(require("../services/exportService"));
const router = (0, express_1.Router)();
router.post('/generate', async (req, res) => {
    try {
        const { customer_id, start_date, end_date, generated_by } = req.body;
        if (!customer_id || !start_date || !end_date) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        const result = await settlementService.generateSettlementReport(customer_id, start_date, end_date, generated_by || 'system');
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:id/confirm', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        await settlementService.confirmSettlement(reportId);
        res.json({ success: true, message: '结算确认成功' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const { customer_id } = req.query;
        if (customer_id) {
            const reports = await settlementDao.getSettlementReportsByCustomer(parseInt(customer_id));
            return res.json(reports);
        }
        const reports = await settlementDao.getAllSettlementReports();
        res.json(reports);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const result = await settlementService.getReportWithDetails(reportId);
        res.json(result);
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
router.get('/:id/export', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const csv = await exportService.exportSettlementReportToCSV(reportId);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=settlement-report-${reportId}.csv`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/export/weighing', async (req, res) => {
    try {
        const { customer_id, status } = req.query;
        const csv = await exportService.exportWeighingRecordsToCSV(customer_id ? parseInt(customer_id) : undefined, status);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=weighing-records.csv');
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
