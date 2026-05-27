"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reconciliation_1 = __importDefault(require("./routes/reconciliation"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use('/api/reconciliation', reconciliation_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'street-activity-reconciliation',
    });
});
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   街道活动对账服务已启动                                    ║
║                                                            ║
║   服务地址: http://localhost:${PORT}                        ║
║                                                            ║
║   API接口:                                                  ║
║   GET  /health                                  健康检查   ║
║                                                            ║
║   POST /api/reconciliation/import/registrations  导入报名  ║
║   POST /api/reconciliation/import/waitlist      导入候补   ║
║   POST /api/reconciliation/import/checkins      导入签到   ║
║   POST /api/reconciliation/import/blacklist     导入黑名单 ║
║                                                            ║
║   POST /api/reconciliation/process             启动对账    ║
║   GET  /api/reconciliation/batches             获取批次列表║
║   GET  /api/reconciliation/batches/:id         获取批次详情║
║                                                            ║
║   POST /api/reconciliation/review               单条复核    ║
║   POST /api/reconciliation/review/batch         批量复核    ║
║                                                            ║
║   GET  /api/reconciliation/records/:id          记录详情    ║
║   GET  /api/reconciliation/records/:id/explain  状态解释    ║
║                                                            ║
║   GET  /api/reconciliation/report/:id/summary   汇总CSV     ║
║   GET  /api/reconciliation/report/:id/detailed  详情报告    ║
║   GET  /api/reconciliation/report/:id/discrepancy 差异分析 ║
║   GET  /api/reconciliation/report/:id/audit     审计追踪    ║
║   GET  /api/reconciliation/report/:id/json      JSON报告    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
exports.default = app;
