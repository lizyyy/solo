"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const ticketImporter_1 = require("../services/ticketImporter");
const authReminder_1 = require("../services/authReminder");
const audioManager_1 = require("../services/audioManager");
const visualizer_1 = require("../services/visualizer");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'sampling-auth-chain' });
});
app.get('/api/batches', (req, res) => {
    const batches = (0, ticketImporter_1.getAllBatches)();
    res.json({ success: true, data: batches });
});
app.get('/api/batches/:batchId', (req, res) => {
    const viz = (0, visualizer_1.getBatchVisualization)(req.params.batchId);
    if (!viz) {
        return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: viz });
});
app.get('/api/tickets/batch/:batchId', (req, res) => {
    const tickets = (0, ticketImporter_1.getTicketsByBatch)(req.params.batchId);
    res.json({ success: true, data: tickets });
});
app.get('/api/tickets/:ticketId', (req, res) => {
    const ticket = (0, ticketImporter_1.getTicketById)(parseInt(req.params.ticketId));
    if (!ticket) {
        return res.status(404).json({ success: false, error: '票据不存在' });
    }
    res.json({ success: true, data: ticket });
});
app.get('/api/reminders', (req, res) => {
    const role = req.query.role;
    const reminders = role
        ? (0, authReminder_1.getRemindersByAssignee)(role)
        : (0, authReminder_1.getAllReminders)();
    res.json({ success: true, data: reminders });
});
app.get('/api/reminders/ticket/:ticketId', (req, res) => {
    const reminder = (0, authReminder_1.getReminderByTicketId)(parseInt(req.params.ticketId));
    if (!reminder) {
        return res.status(404).json({ success: false, error: '提醒不存在' });
    }
    res.json({ success: true, data: reminder });
});
app.post('/api/tickets/:ticketId/remark', (req, res) => {
    const { remark, operator } = req.body;
    if (!remark) {
        return res.status(400).json({ success: false, error: '缺少备注内容' });
    }
    const success = (0, audioManager_1.updateAudioRemark)(parseInt(req.params.ticketId), remark, operator);
    if (success) {
        const reminder = (0, authReminder_1.getReminderByTicketId)(parseInt(req.params.ticketId));
        res.json({ success: true, data: reminder });
    }
    else {
        res.status(500).json({ success: false, error: '更新失败' });
    }
});
app.post('/api/tickets/:ticketId/review', (req, res) => {
    const { approve, remark, operator } = req.body;
    const result = (0, authReminder_1.recordingEngineerReview)(parseInt(req.params.ticketId), approve === true, remark || '');
    if (result) {
        res.json({ success: true, data: result });
    }
    else {
        res.status(500).json({ success: false, error: '复核失败' });
    }
});
app.get('/api/trace/:ticketId', (req, res) => {
    const trace = (0, visualizer_1.getTicketTrace)(parseInt(req.params.ticketId));
    if (!trace) {
        return res.status(404).json({ success: false, error: '找不到溯源信息' });
    }
    res.json({ success: true, data: trace });
});
app.get('/api/overview', (req, res) => {
    const chartData = (0, visualizer_1.getOverviewChartData)();
    const statusSummary = (0, visualizer_1.getAuthStatusSummary)();
    res.json({ success: true, data: { chartData, statusSummary } });
});
app.post('/api/import', (req, res) => {
    const { filePath } = req.body;
    if (!filePath) {
        return res.status(400).json({ success: false, error: '缺少文件路径' });
    }
    const result = (0, ticketImporter_1.importTicketsFromCsv)(filePath);
    if (result.success) {
        result.batchesCreated.forEach(batchId => {
            (0, authReminder_1.generateInitialRemindersForBatch)(batchId);
        });
    }
    res.json({ success: result.success, data: result });
});
app.use(express_1.default.static(path_1.default.join(__dirname, '..', '..', 'public')));
app.listen(PORT, () => {
    console.log('采样包授权链路 API 服务已启动: http://localhost:' + PORT);
    console.log('小看板页面: http://localhost:' + PORT + '/dashboard.html');
});
exports.default = app;
