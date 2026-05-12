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
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const transactionService_1 = require("../services/transactionService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
function parseTransactionData(row) {
    return {
        transaction_id: String(row.transaction_id || row['交易ID'] || row.id || ''),
        amount: Number(row.amount || row['金额'] || row['交易金额'] || 0),
        merchant: String(row.merchant || row['商户'] || row['交易商户'] || ''),
        category: String(row.category || row['品类'] || row['交易品类'] || ''),
        country: String(row.country || row['国家'] || row['交易国家'] || ''),
        device_id: String(row.device_id || row['设备ID'] || ''),
        user_id: String(row.user_id || row['用户ID'] || ''),
        transaction_time: String(row.transaction_time || row['交易时间'] || new Date().toISOString()),
        is_first_transaction: Number(row.is_first_transaction || row['首次交易'] || 0),
        is_weekend: Number(row.is_weekend || row['周末交易'] || 0),
        is_night: Number(row.is_night || row['夜间交易'] || 0),
        velocity_24h: Number(row.velocity_24h || row['24h频次'] || row['24h交易频次'] || 0),
        amount_deviation: Number(row.amount_deviation || row['金额偏离'] || row['金额偏离度'] || 0),
        risk_score: row.risk_score !== undefined ? Number(row.risk_score) : undefined,
    };
}
router.post('/import', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择要上传的文件' });
        }
        const operator = req.body.operator || 'system';
        let data = [];
        if (req.file.originalname.endsWith('.csv')) {
            data = (0, sync_1.parse)(req.file.buffer, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        }
        else if (req.file.originalname.endsWith('.xlsx') ||
            req.file.originalname.endsWith('.xls')) {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
        else {
            return res.status(400).json({ error: '不支持的文件格式，请上传 CSV 或 Excel 文件' });
        }
        if (!data || data.length === 0) {
            return res.status(400).json({ error: '文件中没有数据' });
        }
        const txDataList = data.map(parseTransactionData).filter((tx) => tx.transaction_id);
        if (txDataList.length === 0) {
            return res.status(400).json({ error: '数据格式错误，请确保包含 transaction_id 或交易ID 列' });
        }
        const result = (0, transactionService_1.importBatchTransactions)(txDataList, operator);
        res.json({
            ok: true,
            total: data.length,
            ...result,
        });
    }
    catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ error: '导入失败: ' + err.message });
    }
});
router.post('/import/json', (req, res) => {
    try {
        const { data, operator } = req.body;
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: '请提供交易数据数组' });
        }
        const txDataList = data.map(parseTransactionData).filter((tx) => tx.transaction_id);
        const result = (0, transactionService_1.importBatchTransactions)(txDataList, operator || 'system');
        res.json({
            ok: true,
            total: data.length,
            ...result,
        });
    }
    catch (err) {
        res.status(500).json({ error: '导入失败: ' + err.message });
    }
});
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const filters = {
            is_anomaly: req.query.is_anomaly !== undefined ? req.query.is_anomaly === 'true' : undefined,
            reviewed: req.query.reviewed !== undefined ? req.query.reviewed === 'true' : undefined,
            review_decision: req.query.review_decision || undefined,
            min_score: req.query.min_score ? parseFloat(req.query.min_score) : undefined,
            max_score: req.query.max_score ? parseFloat(req.query.max_score) : undefined,
            search: req.query.search || undefined,
        };
        const result = (0, transactionService_1.getTransactions)(page, pageSize, filters);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: '查询失败: ' + err.message });
    }
});
router.get('/statistics', (_req, res) => {
    try {
        const stats = (0, transactionService_1.getStatistics)();
        res.json(stats);
    }
    catch (err) {
        res.status(500).json({ error: '获取统计数据失败: ' + err.message });
    }
});
router.get('/export', (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined,
            status: req.query.status || undefined,
        };
        const format = req.query.format || 'json';
        const data = (0, transactionService_1.getAllTransactionsForExport)(filters);
        if (format === 'csv') {
            const headers = [
                '交易ID', '金额', '商户', '品类', '国家', '用户ID', '交易时间',
                '风险评分', '是否异常', '是否已复核', '复核结论', '复核意见', '复核人', '复核时间', '导入时间'
            ];
            const csvRows = [
                headers.join(','),
                ...data.map((row) => [
                    `"${row.transaction_id || ''}"`,
                    row.amount || 0,
                    `"${(row.merchant || '').replace(/"/g, '""')}"`,
                    `"${(row.category || '').replace(/"/g, '""')}"`,
                    `"${(row.country || '').replace(/"/g, '""')}"`,
                    `"${row.user_id || ''}"`,
                    `"${row.transaction_time || ''}"`,
                    (row.risk_score || 0).toFixed(1),
                    row.is_anomaly ? '是' : '否',
                    row.reviewed ? '是' : '否',
                    row.review_decision === 'confirmed' ? '确认异常' : row.review_decision === 'rejected' ? '误判' : '',
                    `"${(row.review_comment || '').replace(/"/g, '""')}"`,
                    `"${row.reviewer || ''}"`,
                    `"${row.reviewed_at || ''}"`,
                    `"${row.created_at || ''}"`,
                ].join(','))
            ];
            const csv = '\ufeff' + csvRows.join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`异常交易报告_${Date.now()}.csv`)}`);
            res.send(csv);
        }
        else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`异常交易报告_${Date.now()}.json`)}`);
            res.json(data);
        }
    }
    catch (err) {
        res.status(500).json({ error: '导出失败: ' + err.message });
    }
});
router.get('/:transactionId', (req, res) => {
    try {
        const tx = (0, transactionService_1.getTransaction)(req.params.transactionId);
        if (!tx) {
            return res.status(404).json({ error: '交易不存在' });
        }
        const explanations = (0, transactionService_1.getExplanations)(req.params.transactionId);
        const versionHistory = (0, transactionService_1.getVersionHistory)(req.params.transactionId);
        res.json({
            transaction: tx,
            explanations,
            version_history: versionHistory,
        });
    }
    catch (err) {
        res.status(500).json({ error: '查询失败: ' + err.message });
    }
});
router.post('/review', (req, res) => {
    try {
        const body = req.body;
        if (!body.transaction_id || !body.decision || !body.reviewer) {
            return res.status(400).json({ error: '缺少必要参数: transaction_id, decision, reviewer' });
        }
        (0, transactionService_1.reviewTransaction)(body);
        res.json({ success: true, message: '复核完成' });
    }
    catch (err) {
        res.status(500).json({ error: '复核失败: ' + err.message });
    }
});
router.post('/rollback/:transactionId', (req, res) => {
    try {
        const { operator } = req.body;
        (0, transactionService_1.rollbackTransaction)(req.params.transactionId, operator || 'system');
        res.json({ success: true, message: '已回滚' });
    }
    catch (err) {
        res.status(500).json({ error: '回滚失败: ' + err.message });
    }
});
router.get('/history/:transactionId', (req, res) => {
    try {
        const history = (0, transactionService_1.getVersionHistory)(req.params.transactionId);
        res.json(history);
    }
    catch (err) {
        res.status(500).json({ error: '查询历史记录失败: ' + err.message });
    }
});
exports.default = router;
