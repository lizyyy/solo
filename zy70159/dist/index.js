"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("./config/database"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: '数据导出审批服务',
        timestamp: new Date().toISOString(),
    });
});
async function startServer() {
    try {
        await database_1.default.sync();
        console.log('数据库连接成功，表结构已同步');
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`  数据导出审批 API 服务已启动`);
            console.log(`  服务地址: http://localhost:${PORT}`);
            console.log(`  健康检查: http://localhost:${PORT}/health`);
            console.log(`========================================\n`);
            console.log(`可用 API 接口：`);
            console.log(`  POST /api/export/request      - 提交导出申请`);
            console.log(`  GET  /api/export/request/:id  - 查询申请详情`);
            console.log(`  POST /api/export/approve      - 审批通过`);
            console.log(`  POST /api/export/reject       - 审批驳回`);
            console.log(`  POST /api/export/process      - 处理已审批通过的申请`);
            console.log(`  POST /api/export/download/:id - 下载导出文件`);
            console.log(`  GET  /api/export/report/:id   - 生成任务报告`);
            console.log(`  GET  /api/sensitive-fields    - 获取敏感字段列表`);
            console.log(`  POST /api/sensitive-fields    - 创建敏感字段`);
            console.log(`  GET  /api/exceptions/pending  - 获取待处理异常`);
            console.log(`  GET  /api/exceptions          - 获取所有异常记录`);
            console.log(`  POST /api/exceptions/:id/process - 处理异常记录`);
            console.log(`\n`);
        });
    }
    catch (error) {
        console.error('服务启动失败：', error);
        process.exit(1);
    }
}
startServer();
