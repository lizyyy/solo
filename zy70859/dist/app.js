"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./database");
const services_1 = require("./services");
const routes_1 = require("./routes");
const PORT = process.env.PORT || 3000;
async function startServer() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(body_parser_1.default.json());
    app.use(body_parser_1.default.urlencoded({ extended: true }));
    const db = await (0, database_1.initDatabase)();
    const service = new services_1.DocumentService(db);
    const routes = (0, routes_1.createRoutes)(service);
    app.use('/api', routes);
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', message: '法院卷宗借阅归还 API 服务运行正常' });
    });
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log('API 文档:');
        console.log('  POST /api/batches - 创建批次');
        console.log('  GET  /api/batches - 获取所有批次');
        console.log('  GET  /api/batches/:batchId - 获取批次详情');
        console.log('  GET  /api/batches/:batchId/materials - 获取批次下的材料');
        console.log('  POST /api/batches/:batchId/materials - 登记材料');
        console.log('  POST /api/batches/:batchId/recalculate - 触发批次重算');
        console.log('  GET  /api/materials/:materialId - 获取材料详情');
        console.log('  GET  /api/materials/:materialId/trail - 获取材料完整追溯信息');
        console.log('  GET  /api/materials/:materialId/processing-trails - 获取处理轨迹');
        console.log('  GET  /api/materials/:materialId/audit-logs - 获取审计日志');
        console.log('  PATCH /api/materials/:materialId/status - 修改材料状态');
        console.log('  GET  /api/statistics - 获取统计数据');
    });
}
startServer().catch(console.error);
