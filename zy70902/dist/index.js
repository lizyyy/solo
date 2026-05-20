"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const importRoutes_1 = __importDefault(require("./routes/importRoutes"));
const reconciliationRoutes_1 = __importDefault(require("./routes/reconciliationRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const traceabilityRoutes_1 = __importDefault(require("./routes/traceabilityRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/import', importRoutes_1.default);
app.use('/api/reconciliation', reconciliationRoutes_1.default);
app.use('/api/review', reviewRoutes_1.default);
app.use('/api/report', reportRoutes_1.default);
app.use('/api/traceability', traceabilityRoutes_1.default);
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '景区缆车检修放行对账服务运行正常',
        timestamp: new Date().toISOString(),
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API 路由不存在',
    });
});
app.listen(PORT, () => {
    console.log(`🚀 景区缆车检修放行对账服务已启动`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('📋 API 路由:');
    console.log('  数据导入: POST /api/import/*');
    console.log('  对账处理: POST /api/reconciliation/:batchId');
    console.log('  人工复核: POST /api/review/:resultId/diff/:diffId');
    console.log('  报告生成: POST /api/report');
    console.log('  追溯查询: GET /api/traceability/*');
});
exports.default = app;
//# sourceMappingURL=index.js.map