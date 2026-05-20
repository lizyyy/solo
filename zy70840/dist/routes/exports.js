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
const ExportService_1 = __importDefault(require("../services/ExportService"));
const dayjs_1 = __importDefault(require("dayjs"));
const fs = __importStar(require("fs"));
const router = (0, express_1.Router)();
router.post('/applications', async (req, res) => {
    try {
        const { status, merchantName, stallLocation, certificateVersion, startDate, endDate, includeDetails } = req.body;
        const filters = {
            status: status,
            merchantName,
            stallLocation,
            certificateVersion,
            startDate: startDate ? (0, dayjs_1.default)(startDate).toDate() : undefined,
            endDate: endDate ? (0, dayjs_1.default)(endDate).toDate() : undefined,
        };
        const result = await ExportService_1.default.exportApplications(filters, includeDetails);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/logs', async (req, res) => {
    try {
        const { applicationId, startDate, endDate } = req.body;
        const result = await ExportService_1.default.exportLogs(applicationId ? parseInt(applicationId) : undefined, startDate ? (0, dayjs_1.default)(startDate).toDate() : undefined, endDate ? (0, dayjs_1.default)(endDate).toDate() : undefined);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/deposit-flows', async (req, res) => {
    try {
        const { applicationId, startDate, endDate } = req.body;
        const result = await ExportService_1.default.exportDepositFlows(applicationId ? parseInt(applicationId) : undefined, startDate ? (0, dayjs_1.default)(startDate).toDate() : undefined, endDate ? (0, dayjs_1.default)(endDate).toDate() : undefined);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/download/:filename', async (req, res) => {
    try {
        const filenameParam = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
        const filePath = ExportService_1.default.getExportFilePath(filenameParam);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在' });
        }
        res.download(filePath);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
