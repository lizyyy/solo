"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ticket_importer_1 = require("./import/ticket-importer");
const remark_manager_1 = require("./track/remark-manager");
const audio_rehearsal_manager_1 = require("./track/audio-rehearsal-manager");
const classifier_1 = require("./classification/classifier");
const checks_1 = require("./self-check/checks");
const data_layer_1 = require("./unified-output/data-layer");
const sync_1 = require("csv-stringify/sync");
const app = (0, express_1.default)();
const PORT = 3000;
app.use(express_1.default.json());
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '音乐夏令营分班系统运行中' });
});
app.post('/api/import', (req, res) => {
    try {
        const { csvContent, fileName, importedBy, forceReimport } = req.body;
        const result = (0, ticket_importer_1.importTicketCsv)(csvContent, fileName, importedBy, forceReimport);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});
app.get('/api/tickets', (req, res) => {
    const data = (0, data_layer_1.getAllTicketRowViews)();
    res.json({ success: true, data });
});
app.get('/api/tickets/:id', (req, res) => {
    const data = (0, data_layer_1.getTicketRowDetailView)(req.params.id);
    if (!data) {
        return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data });
});
app.post('/api/tickets/:id/audio-remark', (req, res) => {
    const { audioRemark, addedBy } = req.body;
    const success = (0, audio_rehearsal_manager_1.addAudioFileRemark)(req.params.id, audioRemark, addedBy);
    res.json({ success });
});
app.post('/api/tickets/:id/track-remark', (req, res) => {
    const { type, content, addedBy, isReworkReason, retainReason } = req.body;
    const result = (0, remark_manager_1.addTrackRemark)(req.params.id, type, content, addedBy, isReworkReason, retainReason);
    res.json({ success: !!result, data: result });
});
app.post('/api/tickets/:id/rehearsal-change', (req, res) => {
    const { changeType, oldValue, newValue, reason, changedBy, relatedRemarkId } = req.body;
    const result = (0, audio_rehearsal_manager_1.addRehearsalChange)(req.params.id, changeType, oldValue, newValue, reason, changedBy, relatedRemarkId);
    res.json({ success: !!result, data: result });
});
app.get('/api/tickets/:rowId/rehearsal-changes/:changeId', (req, res) => {
    const data = (0, data_layer_1.getRehearsalChangeDetail)(req.params.rowId, req.params.changeId);
    if (!data) {
        return res.status(404).json({ success: false, error: '变更记录不存在' });
    }
    res.json({ success: true, data });
});
app.post('/api/tickets/:id/review-rework', (req, res) => {
    const { remarkId, reviewedBy, approveAsNormal } = req.body;
    const success = (0, remark_manager_1.reviewReworkRemark)(req.params.id, remarkId, reviewedBy, approveAsNormal);
    res.json({ success });
});
app.post('/api/recalculate', (req, res) => {
    const { updatedBy } = req.body;
    const result = (0, classifier_1.recalculateClassification)(updatedBy || '系统');
    res.json({ success: true, data: result });
});
app.get('/api/self-check', (req, res) => {
    const results = (0, checks_1.runAllChecks)();
    const allPassed = results.every(r => r.passed);
    res.json({ success: true, allPassed, data: results });
});
app.get('/api/export', (req, res) => {
    const rows = (0, data_layer_1.getExportRows)();
    const csv = (0, sync_1.stringify)(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=music-camp-classification.csv');
    res.send('\uFEFF' + csv);
});
app.listen(PORT, () => {
    console.log(`🎵 音乐夏令营分班系统已启动: http://localhost:${PORT}`);
    console.log(`   API文档:`);
    console.log(`   GET  /api/health           - 健康检查`);
    console.log(`   POST /api/import           - 导入票务CSV`);
    console.log(`   GET  /api/tickets          - 获取所有记录（列表页用）`);
    console.log(`   GET  /api/tickets/:id      - 获取单条记录详情`);
    console.log(`   POST /api/tickets/:id/audio-remark  - 添加音频备注`);
    console.log(`   POST /api/tickets/:id/track-remark  - 添加轨道备注`);
    console.log(`   POST /api/tickets/:id/rehearsal-change - 添加排练变更`);
    console.log(`   GET  /api/tickets/:rowId/rehearsal-changes/:changeId - 查看排练变更详情`);
    console.log(`   POST /api/tickets/:id/review-rework  - 复核返工原因`);
    console.log(`   POST /api/recalculate      - 重算分班结果`);
    console.log(`   GET  /api/self-check       - 执行自检`);
    console.log(`   GET  /api/export           - 导出CSV（与页面、接口同一份数据）`);
});
