"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const importRoutes_1 = __importDefault(require("./routes/importRoutes"));
const reconciliationRoutes_1 = __importDefault(require("./routes/reconciliationRoutes"));
const reviewRoutes_1 = __importDefault(require("./routes/reviewRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const dataStore_1 = require("./store/dataStore");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/health', (_req, res) => {
    res.json({ status: 'ok', message: '设备租赁对账服务运行中' });
});
app.use('/api/import', importRoutes_1.default);
app.use('/api/reconciliation', reconciliationRoutes_1.default);
app.use('/api/review', reviewRoutes_1.default);
app.use('/api/report', reportRoutes_1.default);
app.get('/api/data/clear', (_req, res) => {
    dataStore_1.dataStore.clearAll();
    res.json({ message: '所有数据已清空' });
});
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误', message: err.message });
});
app.listen(PORT, () => {
    console.log(`设备租赁对账服务已启动，端口: ${PORT}`);
    console.log('API 端点:');
    console.log('  POST /api/import/rental-orders - 导入租赁订单CSV');
    console.log('  POST /api/import/repair-records - 导入维修记录JSON');
    console.log('  POST /api/import/deposit-rules - 导入押金规则');
    console.log('  POST /api/reconciliation/order/:orderNo - 单个订单对账');
    console.log('  POST /api/reconciliation/all - 全部订单对账');
    console.log('  POST /api/review/approve/:orderNo - 通过订单');
    console.log('  POST /api/review/reject/:orderNo - 退回订单');
    console.log('  POST /api/review/request-more-info/:orderNo - 要求补充材料');
    console.log('  GET /api/report/detailed/:orderNo - 获取详情报告');
    console.log('  GET /api/report/summary - 获取汇总报告');
    console.log('  GET /api/report/export/detailed/:orderNo - 导出详情Excel');
    console.log('  GET /api/report/deduction-evidence/:orderNo - 获取扣款依据');
});
exports.default = app;
