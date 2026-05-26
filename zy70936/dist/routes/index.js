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
const importService = __importStar(require("../services/importService"));
const recordService = __importStar(require("../services/recordService"));
const auditService = __importStar(require("../services/auditService"));
const privacyService = __importStar(require("../services/privacyService"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
router.post('/import/customers', async (req, res) => {
    try {
        const { filePath, operator } = req.body;
        const result = await importService.importCustomersFromJson(filePath, operator);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/import/medicines', async (req, res) => {
    try {
        const { filePath, operator } = req.body;
        const result = await importService.importMedicinesFromJson(filePath, operator);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/import/rules', async (req, res) => {
    try {
        const { filePath, operator } = req.body;
        const result = await importService.importFollowUpRulesFromJson(filePath, operator);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/import/purchases', async (req, res) => {
    try {
        const { filePath, operator } = req.body;
        const result = await importService.importPurchaseRecordsFromCsv(filePath, operator);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/records/pending', (req, res) => {
    try {
        const { batchId } = req.query;
        const records = recordService.getPendingRecords(batchId);
        res.json({ total: records.length, records });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/records/:id', (req, res) => {
    try {
        const record = recordService.getRecordById(req.params.id);
        if (!record) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        res.json(record);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/records/:id/audit', (req, res) => {
    try {
        const result = recordService.getRecordWithAuditTrail(req.params.id);
        if (!result) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/records/:id/process', (req, res) => {
    try {
        const { action, reason, operator, notes } = req.body;
        if (!['approve', 'reject', 'return'].includes(action)) {
            res.status(400).json({ error: '无效的操作类型' });
            return;
        }
        if (!reason || !operator) {
            res.status(400).json({ error: '原因和处理人不能为空' });
            return;
        }
        const record = recordService.processRecord(req.params.id, action, reason, operator, notes);
        if (!record) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        res.json(record);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/records/query', (req, res) => {
    try {
        const filter = req.body;
        const records = recordService.queryRecords(filter);
        res.json({ total: records.length, records });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/records/export', (req, res) => {
    try {
        const filter = req.body;
        const records = recordService.exportRecords(filter);
        res.json({
            total: records.length,
            records,
            exportTime: new Date().toISOString()
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/customers', (req, res) => {
    try {
        const db = require('../database').getDb();
        const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
        const maskedCustomers = customers.map(c => ({
            ...c,
            tags: JSON.parse(c.tags || '[]'),
            idCard: privacyService.maskIdCard(c.id_card),
            phone: privacyService.maskPhone(c.phone),
            address: privacyService.maskAddress(c.address)
        }));
        res.json({ total: maskedCustomers.length, customers: maskedCustomers });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/medicines', (req, res) => {
    try {
        const db = require('../database').getDb();
        const medicines = db.prepare('SELECT * FROM medicines').all();
        const result = medicines.map(m => ({
            ...m,
            contraindications: JSON.parse(m.contraindications || '[]'),
            isControlled: m.is_controlled === 1,
            minIntervalDays: m.min_interval_days,
            maxDosage: m.max_dosage
        }));
        res.json({ total: result.length, medicines: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/audit/logs', (req, res) => {
    try {
        const { operator, recordId } = req.query;
        let logs;
        if (recordId) {
            logs = auditService.getAuditLogsForRecord(recordId);
        }
        else if (operator) {
            logs = auditService.getAuditLogsByOperator(operator);
        }
        else {
            res.status(400).json({ error: '请提供operator或recordId参数' });
            return;
        }
        res.json({ total: logs.length, logs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/batches', (req, res) => {
    try {
        const db = require('../database').getDb();
        const batches = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all();
        res.json({ total: batches.length, batches });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
