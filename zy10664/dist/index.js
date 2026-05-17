"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/tasks', taskRoutes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: '任务调度平台失败任务熔断恢复 API' });
});
app.use((req, res) => {
    res.status(404).json({ success: false, message: '接口不存在' });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 文档:`);
    console.log(`  POST   /api/tasks              - 创建任务`);
    console.log(`  GET    /api/tasks              - 任务列表`);
    console.log(`  GET    /api/tasks/:id          - 任务详情`);
    console.log(`  PUT    /api/tasks/:id          - 更新任务`);
    console.log(`  POST   /api/tasks/:id/failure  - 记录失败`);
    console.log(`  POST   /api/tasks/:id/apply-recovery  - 申请恢复`);
    console.log(`  POST   /api/tasks/:id/audit-recovery  - 审核恢复`);
    console.log(`  POST   /api/tasks/:id/withdraw - 撤回申请`);
    console.log(`  POST   /api/tasks/:id/manual-remark - 人工备注（处理队列重试）`);
    console.log(`  PUT    /api/tasks/:taskId/conditions/:conditionId/meet - 标记恢复条件已满足`);
    console.log(`  GET    /api/tasks/export/csv   - 导出CSV`);
    console.log(`  POST   /api/tasks/import       - 导入任务`);
});
exports.default = app;
