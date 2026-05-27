"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.get('/', (_req, res) => {
    res.json({
        service: '跨币种发票贴现 API',
        version: '1.0.0',
        description: '处理美元发票、欧元回款、人民币贴现利息的多币种换算与贴现管理',
        endpoints: {
            health: 'GET /api/health',
            calculate: 'POST /api/calculate',
            invoices: 'GET /api/invoices, POST /api/invoices',
            invoiceById: 'GET /api/invoices/:id, PUT /api/invoices/:id',
            advanceStatus: 'POST /api/invoices/:id/advance',
            export: 'POST /api/invoices/:id/export',
            profitReport: 'POST /api/invoices/:id/profit-report, GET /api/invoices/:id/profit-report',
            payments: 'GET /api/payments, POST /api/payments',
            matchPayment: 'POST /api/payments/:id/match',
            bankReceipts: 'GET /api/bank-receipts, POST /api/bank-receipts',
        },
        baseUrl: `http://localhost:${PORT}/api`,
    });
});
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('  跨币种发票贴现 API 已启动');
    console.log('='.repeat(60));
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  API 根路径: http://localhost:${PORT}/api`);
    console.log(`  健康检查: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(60));
    console.log('  已预置示例数据:');
    console.log('  - 发票 INV-2026-001 (USD 100,000)');
    console.log('  - 回款 EUR 50,000');
    console.log('='.repeat(60));
});
exports.default = app;
