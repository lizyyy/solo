"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./database");
const ticketScan_routes_1 = __importDefault(require("./routes/ticketScan.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api/ticket-scan', ticketScan_routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ticket-attachment-scan-api'
    });
});
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
async function startServer() {
    try {
        await (0, database_1.initDatabase)();
        console.log('数据库初始化完成');
        app.listen(PORT, () => {
            console.log(`
============================================
工单附件病毒扫描API 已启动
端口: ${PORT}
健康检查: http://localhost:${PORT}/health
API 路径: http://localhost:${PORT}/api/ticket-scan
============================================
      `);
        });
    }
    catch (err) {
        console.error('服务启动失败:', err);
        process.exit(1);
    }
}
startServer();
