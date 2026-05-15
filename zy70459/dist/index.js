"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./database");
const validation_1 = __importDefault(require("./routes/validation"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
(0, database_1.initDatabase)();
app.use('/api/validation', validation_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: '冻结窗口校验服务运行正常'
    });
});
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});
app.listen(PORT, () => {
    console.log(`
============================================
  冻结窗口校验后端服务已启动
  服务地址: http://localhost:${PORT}
  
  API端点:
  - GET  /health                              - 健康检查
  - POST /api/validation/validate            - 单样本校验
  - GET  /api/validation/query/:businessNo   - 按业务单号查询
  - GET  /api/validation/query               - 查询所有样本
  - GET  /api/validation/failures            - 查询失败记录
  - GET  /api/validation/anomalies           - 查询异常样本
  - POST /api/validation/batch/preview       - 批量操作预览
  - POST /api/validation/batch/execute/:id   - 执行批量操作
  - GET  /api/validation/summary             - 获取摘要
  - GET  /api/validation/summary/report      - 获取摘要报告
  - GET  /api/validation/statistics/errors   - 获取错误统计
  - GET  /api/validation/window/check        - 检查当前冻结窗口
============================================
  `);
});
