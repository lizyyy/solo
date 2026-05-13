"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./db");
const receipts_1 = __importDefault(require("./routes/receipts"));
const employees_1 = __importDefault(require("./routes/employees"));
const merchants_1 = __importDefault(require("./routes/merchants"));
const settlements_1 = __importDefault(require("./routes/settlements"));
const appeals_1 = __importDefault(require("./routes/appeals"));
const export_1 = __importDefault(require("./routes/export"));
const stats_1 = __importDefault(require("./routes/stats"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3003;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
(0, db_1.initDatabase)();
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '企业用餐补贴核销台服务运行正常',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/receipts', receipts_1.default);
app.use('/api/employees', employees_1.default);
app.use('/api/merchants', merchants_1.default);
app.use('/api/settlements', settlements_1.default);
app.use('/api/appeals', appeals_1.default);
app.use('/api/export', export_1.default);
app.use('/api/stats', stats_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  企业用餐补贴核销台 - 后端服务`);
    console.log(`  运行端口: ${PORT}`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`========================================\n`);
    console.log('可用API端点:');
    console.log('  GET  /api/health          - 健康检查');
    console.log('  GET  /api/receipts        - 小票列表');
    console.log('  POST /api/receipts        - 上传小票');
    console.log('  GET  /api/receipts/:id    - 小票详情');
    console.log('  GET  /api/employees       - 员工列表');
    console.log('  GET  /api/merchants       - 商户列表');
    console.log('  GET  /api/settlements     - 结算单列表');
    console.log('  POST /api/settlements/generate  - 生成结算单');
    console.log('  GET  /api/appeals         - 申诉列表');
    console.log('  POST /api/appeals         - 提交申诉');
    console.log('  GET  /api/stats/overview  - 统计概览');
    console.log('  GET  /api/export/receipts - 导出小票Excel');
    console.log('');
});
