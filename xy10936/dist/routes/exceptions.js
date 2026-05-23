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
const settlementDao = __importStar(require("../dao/settlementDao"));
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { handled } = req.query;
        if (handled === 'false') {
            const exceptions = await settlementDao.getUnhandledExceptions();
            return res.json(exceptions);
        }
        const exceptions = await settlementDao.getAllExceptionRecords();
        res.json(exceptions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const exception = await settlementDao.getExceptionRecordById(id);
        if (!exception) {
            return res.status(404).json({ error: '异常记录不存在' });
        }
        res.json(exception);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/handle', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { handled_by, conclusion } = req.body;
        if (!handled_by || !conclusion) {
            return res.status(400).json({ error: '处理人和处理结论不能为空' });
        }
        await settlementDao.handleException(id, handled_by, conclusion);
        res.json({ success: true, message: '异常处理完成' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
