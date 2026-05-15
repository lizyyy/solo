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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportExporter = exports.RequestSizeGuardrail = void 0;
const express_1 = __importDefault(require("express"));
const guardrail_1 = require("./guardrail");
Object.defineProperty(exports, "RequestSizeGuardrail", { enumerable: true, get: function () { return guardrail_1.RequestSizeGuardrail; } });
const exporter_1 = require("./exporter");
Object.defineProperty(exports, "ReportExporter", { enumerable: true, get: function () { return exporter_1.ReportExporter; } });
__exportStar(require("./types"), exports);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const guardrail = new guardrail_1.RequestSizeGuardrail();
const exporter = new exporter_1.ReportExporter(guardrail);
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'request-size-guardrail',
        timestamp: new Date().toISOString(),
        config: guardrail.getConfig()
    });
});
app.post('/api/guardrail/check', (req, res) => {
    try {
        const { source, requestType, input, metadata } = req.body;
        if (!input) {
            return res.status(400).json({ error: 'input is required' });
        }
        const result = guardrail.processRequest(source || 'api', requestType || 'unknown', input, metadata || {});
        res.json({
            success: true,
            recordId: result.record.id,
            isDuplicate: result.isDuplicate,
            hasIssues: result.record.fieldIssues.length > 0,
            issues: result.record.fieldIssues,
            status: result.record.status,
            record: result.record
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/records', (req, res) => {
    try {
        const { status, hasIssues } = req.query;
        let records = guardrail.getAllRecords();
        if (status) {
            records = records.filter(r => r.status === status);
        }
        if (hasIssues === 'true') {
            records = records.filter(r => r.fieldIssues.length > 0);
        }
        res.json({
            success: true,
            total: records.length,
            records
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/records/:id', (req, res) => {
    try {
        const record = guardrail.getRecordById(req.params.id);
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json({ success: true, record });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/records/:id/field/:fieldPath', (req, res) => {
    try {
        const value = guardrail.getFieldOriginalValue(req.params.id, req.params.fieldPath);
        if (value === null) {
            return res.status(404).json({ error: 'Field not found' });
        }
        res.json({
            success: true,
            fieldPath: req.params.fieldPath,
            originalValue: value,
            valueLength: typeof value === 'string' ? value.length : undefined
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/records/:id/correct', (req, res) => {
    try {
        const { fieldPath, operator, originalDecision, correctedDecision, reason, evidence } = req.body;
        if (!fieldPath || !operator || !originalDecision || !correctedDecision || !reason) {
            return res.status(400).json({
                error: 'fieldPath, operator, originalDecision, correctedDecision, reason are required'
            });
        }
        const correction = guardrail.addCorrection(req.params.id, fieldPath, operator, originalDecision, correctedDecision, reason, evidence);
        if (!correction) {
            return res.status(404).json({ error: 'Record not found' });
        }
        res.json({
            success: true,
            correction,
            message: 'Correction added successfully'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/export', async (req, res) => {
    try {
        const { generator, format = 'json' } = req.query;
        const report = exporter.generateReport(generator || 'api');
        if (format === 'markdown') {
            const mdPath = exporter.exportToMarkdown(report);
            res.json({
                success: true,
                reportId: report.reportId,
                format: 'markdown',
                filePath: mdPath,
                summary: report.summary
            });
        }
        else {
            const jsonPath = exporter.exportToJSON(report);
            res.json({
                success: true,
                reportId: report.reportId,
                format: 'json',
                filePath: jsonPath,
                summary: report.summary,
                report
            });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/corrections', (req, res) => {
    try {
        const records = guardrail.getAllRecords().filter(r => r.corrections.length > 0);
        const corrections = records.flatMap(record => record.corrections.map(correction => ({
            ...correction,
            recordId: record.id,
            source: record.source,
            requestType: record.requestType
        })));
        res.json({
            success: true,
            total: corrections.length,
            corrections: corrections.map(c => ({
                fieldPath: c.fieldPath,
                source: `${c.recordId} (${c.source} - ${c.requestType})`,
                originalDecision: c.originalDecision,
                correctedDecision: c.correctedDecision,
                evidence: c.evidence,
                operator: c.operator,
                timestamp: c.timestamp
            }))
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🚀 请求大小护栏服务已启动`);
        console.log(`📍 服务地址: http://localhost:${PORT}`);
        console.log(`\n📚 API 端点:`);
        console.log(`   GET  /api/health                - 健康检查`);
        console.log(`   POST /api/guardrail/check       - 检查请求大小`);
        console.log(`   GET  /api/records               - 获取所有记录`);
        console.log(`   GET  /api/records/:id           - 获取单个记录`);
        console.log(`   GET  /api/records/:id/field/*   - 获取字段原始值`);
        console.log(`   POST /api/records/:id/correct   - 添加人工修正`);
        console.log(`   GET  /api/export                - 导出复核报告`);
        console.log(`   GET  /api/corrections           - 获取所有人工修正记录`);
        console.log(`\n🧪 运行测试: npm test`);
        console.log(`📤 手动导出: npm run export\n`);
    });
}
