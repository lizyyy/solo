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
const queryService = __importStar(require("../services/queryService"));
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const records = await queryService.queryRecords(req.query);
        res.json(records);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/export', async (req, res) => {
    try {
        const csv = await queryService.exportToCSV(req.query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="training_records.csv"');
        res.send('\uFEFF' + csv);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/verify-count', async (req, res) => {
    try {
        const result = await queryService.verifyExportCount(req.query);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/student/:batchId/:employeeId', async (req, res) => {
    try {
        const detail = await queryService.getStudentDetail(req.params.batchId, req.params.employeeId);
        if (!detail)
            return res.status(404).json({ error: '学员不存在' });
        res.json(detail);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
