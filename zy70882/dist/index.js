"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const importRoutes_1 = __importDefault(require("./routes/importRoutes"));
const billingRoutes_1 = __importDefault(require("./routes/billingRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({ success: true, message: '冷库园区对账服务运行正常' });
});
app.use('/api/import', importRoutes_1.default);
app.use('/api/billing', billingRoutes_1.default);
app.use('/api/review', reviewRoutes_1.default);
app.use('/api/report', reportRoutes_1.default);
app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});
app.listen(PORT, () => {
    console.log(`冷库园区对账服务已启动，端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 文档:`);
    console.log(`  POST /api/import/meter - 上传电表CSV`);
    console.log(`  POST /api/import/contract - 上传合同JSON`);
    console.log(`  POST /api/billing/calculate - 计算账单`);
    console.log(`  GET  /api/billing/records - 查询账单列表`);
    console.log(`  POST /api/review/records/:id/approve - 审批通过`);
    console.log(`  POST /api/review/records/:id/reject - 审批驳回`);
    console.log(`  GET  /api/report/excel - 下载Excel报告`);
    console.log(`  GET  /api/report/pdf - 下载PDF报告`);
    console.log(`  GET  /api/report/records/:id/html - 查看账单详情HTML`);
});
//# sourceMappingURL=index.js.map