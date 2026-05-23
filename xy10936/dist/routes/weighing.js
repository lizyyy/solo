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
const weighingService = __importStar(require("../services/weighingService"));
const weighingDao = __importStar(require("../dao/weighingDao"));
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { customer_id, category_id, gross_weight, tare_weight, operator } = req.body;
        if (!customer_id || !category_id || gross_weight === undefined || tare_weight === undefined) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        const result = await weighingService.createWeighingRecord({
            customer_id,
            category_id,
            gross_weight,
            tare_weight,
            operator
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const { customer_id, status } = req.query;
        if (customer_id) {
            const records = await weighingDao.getWeighingRecordsByCustomer(parseInt(customer_id));
            return res.json(records);
        }
        if (status) {
            const records = await weighingDao.getWeighingRecordsByStatus(status);
            return res.json(records);
        }
        const records = await weighingDao.getAllWeighingRecords();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const record = await weighingDao.getWeighingRecordById(id);
        if (!record) {
            return res.status(404).json({ error: '称重记录不存在' });
        }
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/verify', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { gross_weight, tare_weight, verifier, remark } = req.body;
        if (!gross_weight || !tare_weight || !verifier) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        await weighingService.verifyWeight(recordId, {
            weighing_record_id: recordId,
            gross_weight,
            tare_weight,
            verifier,
            remark
        });
        res.json({ success: true, message: '重量复核通过' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:id/apply-price', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        await weighingService.applyPrice(recordId);
        res.json({ success: true, message: '价格录入成功' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:id/amount', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const result = await weighingService.calculateSettlementAmount(recordId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:id/correct', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { field_name, new_value, reason, operator } = req.body;
        if (!field_name || !reason || !operator) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        await weighingService.applyManualCorrection(recordId, {
            field_name,
            new_value,
            reason,
            operator
        });
        res.json({ success: true, message: '人工修正已记录' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:id/verifications', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const verifications = await weighingDao.getVerificationsByRecordId(recordId);
        res.json(verifications);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/corrections', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const corrections = await weighingDao.getCorrectionsByRecordId(recordId);
        res.json(corrections);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
