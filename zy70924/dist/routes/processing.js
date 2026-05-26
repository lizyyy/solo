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
const processingService = __importStar(require("../services/processingService"));
const router = (0, express_1.Router)();
router.post('/attendance/:recordId', async (req, res) => {
    try {
        await processingService.processAttendanceRecord({
            recordId: req.params.recordId,
            ...req.body
        });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/homework/:recordId', async (req, res) => {
    try {
        await processingService.processHomeworkRecord({
            recordId: req.params.recordId,
            ...req.body
        });
        res.json({ success: true });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/:recordType/:recordId/history', async (req, res) => {
    try {
        const history = await processingService.getRecordWithHistory(req.params.recordType, req.params.recordId);
        if (!history)
            return res.status(404).json({ error: '记录不存在' });
        res.json(history);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
exports.default = router;
