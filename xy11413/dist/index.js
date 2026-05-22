"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = require("./database/connection");
const taskExecutor_1 = require("./services/taskExecutor");
const import_1 = __importDefault(require("./routes/import"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const export_1 = __importDefault(require("./routes/export"));
const anomalies_1 = __importDefault(require("./routes/anomalies"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json({ limit: '10mb' }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api/import', import_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/export', export_1.default);
app.use('/api/anomalies', anomalies_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.json({
        name: '连锁茶饮原料验收回放链路 API',
        version: '1.0.0',
        endpoints: {
            import: '/api/import',
            tasks: '/api/tasks',
            export: '/api/export',
            anomalies: '/api/anomalies',
            health: '/health'
        }
    });
});
const server = app.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          连锁茶饮原料验收回放链路 API 服务已启动               ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                            ║
║  健康检查: http://localhost:${PORT}/health                     ║
║  API 文档: http://localhost:${PORT}/                           ║
╠══════════════════════════════════════════════════════════════╣
║  Authorization: Bearer tea-chain-verification-2024           ║
║  角色设置: X-User-Role (admin/operator/viewer)                ║
╚══════════════════════════════════════════════════════════════╝
  `);
    (0, connection_1.getDbConnection)();
    await (0, taskExecutor_1.runRecovery)();
    (0, taskExecutor_1.startTaskExecutor)();
});
const gracefulShutdown = () => {
    console.log('\n正在优雅关闭服务...');
    (0, taskExecutor_1.stopTaskExecutor)();
    server.close(() => {
        console.log('HTTP 服务已关闭');
        (0, connection_1.closeDbConnection)();
        process.exit(0);
    });
    setTimeout(() => {
        console.error('强制关闭');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
