"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
require("./database/init");
const ruleVersions_1 = __importDefault(require("./routes/ruleVersions"));
const batches_1 = __importDefault(require("./routes/batches"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
const waives_1 = __importDefault(require("./routes/waives"));
const reports_1 = __importDefault(require("./routes/reports"));
const logs_1 = __importDefault(require("./routes/logs"));
const dataDir = path_1.default.join(__dirname, '../data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});
app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'data-quality-rule-api',
            version: '1.0.0',
        },
    });
});
app.use('/api/rule-versions', ruleVersions_1.default);
app.use('/api/batches', batches_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
app.use('/api/waives', waives_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/logs', logs_1.default);
app.get('/api', (req, res) => {
    res.json({
        success: true,
        data: {
            service: '数据质量规则发布 API',
            version: '1.0.0',
            endpoints: {
                '规则版本管理': '/api/rule-versions',
                '批次重算': '/api/batches',
                '告警订阅': '/api/subscriptions',
                '误报豁免': '/api/waives',
                '质量报表': '/api/reports',
                '操作日志': '/api/logs',
            },
            documentation: '参见 API 文档了解详细用法',
        },
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `路径不存在: ${req.originalUrl}`,
        },
    });
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误',
        },
    });
});
app.listen(PORT, () => {
    console.log(`数据质量规则发布 API 服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 入口: http://localhost:${PORT}/api`);
});
//# sourceMappingURL=index.js.map