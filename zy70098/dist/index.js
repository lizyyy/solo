"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./database/database");
const routes_1 = require("./api/routes");
async function main() {
    const app = (0, express_1.default)();
    const PORT = process.env.PORT || 3000;
    const db = await database_1.DatabaseService.create('./data/app.db');
    app.use(express_1.default.json());
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'demand-response-invitation-service'
        });
    });
    app.use('/api', (0, routes_1.createRoutes)(db));
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: '服务器内部错误',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        });
    });
    const server = app.listen(PORT, () => {
        console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   需求响应邀约服务已启动                                      │
│   服务端口: ${PORT}                                          │
│   健康检查: http://localhost:${PORT}/health                  │
│   API 根路径: http://localhost:${PORT}/api                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
    `);
    });
    process.on('SIGTERM', () => {
        console.log('收到 SIGTERM 信号，正在关闭...');
        server.close(() => {
            db.close();
            process.exit(0);
        });
    });
    process.on('SIGINT', () => {
        console.log('收到 SIGINT 信号，正在关闭...');
        server.close(() => {
            db.close();
            process.exit(0);
        });
    });
}
main().catch(err => {
    console.error('服务启动失败:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map