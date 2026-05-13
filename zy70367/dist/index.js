"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const reference_1 = __importDefault(require("./routes/reference"));
const import_1 = __importDefault(require("./routes/import"));
const revoke_1 = __importDefault(require("./routes/revoke"));
const report_1 = __importDefault(require("./routes/report"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
app.use('/api/reference', reference_1.default);
app.use('/api/import', import_1.default);
app.use('/api/revoke', revoke_1.default);
app.use('/api/report', report_1.default);
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err?.message || '服务器内部错误'
    });
});
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  用户导入撤销 API 服务启动成功!`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  健康检查: http://localhost:${PORT}/health`);
    console.log(`========================================\n`);
    console.log(`API 路由:
  - GET  /api/reference/departments    - 获取部门列表
  - GET  /api/reference/roles          - 获取角色列表
  
  - POST /api/import/batches           - 创建导入批次
  - GET  /api/import/batches           - 获取批次列表
  - GET  /api/import/batches/:id       - 获取批次详情
  - POST /api/import/batches/:id/precheck - 预检批次
  - POST /api/import/batches/:id/confirm  - 确认导入
  
  - GET  /api/revoke/batches/:id/can-revoke - 检查可撤销状态
  - POST /api/revoke/batches/:id/revoke    - 撤销整批
  - POST /api/revoke/batches/:id/revoke/:email - 撤销单个用户
  
  - GET  /api/report/batches/:id/report    - 获取批次报告
  - GET  /api/report/users                 - 获取用户列表（含批次来源）
  - GET  /api/report/users/:email          - 获取用户详情
  - GET  /api/report/batches/:id/reimport-context - 获取重新导入上下文
`);
});
