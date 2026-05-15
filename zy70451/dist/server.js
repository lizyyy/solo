"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const handoverRoutes_1 = __importDefault(require("./routes/handoverRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/handover', handoverRoutes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '租户开通台服务运行正常' });
});
app.listen(PORT, () => {
    console.log(`🚀 租户开通台服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);
    console.log(`📁 API文档:`);
    console.log(`   - POST   /api/handover              - 创建交接单`);
    console.log(`   - GET    /api/handover              - 获取交接单列表`);
    console.log(`   - GET    /api/handover/:id          - 获取交接单详情`);
    console.log(`   - POST   /api/handover/:id/process  - 处理交接单`);
    console.log(`   - POST   /api/handover/:id/manual-fix - 人工修正`);
    console.log(`   - POST   /api/handover/:id/material-summary - 添加材料摘要`);
    console.log(`   - GET    /api/handover/history/all  - 获取所有历史记录`);
    console.log(`   - GET    /api/handover/history/query?resourceRange=xxx - 按资源范围查询历史`);
});
exports.default = app;
