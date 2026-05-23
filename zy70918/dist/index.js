"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const api_1 = __importDefault(require("./routes/api"));
const dataStore_1 = __importDefault(require("./store/dataStore"));
const sampleData_1 = require("./sampleData");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.get('/', (req, res) => {
    res.json({
        message: '护理站对账服务 API',
        version: '1.0.0',
        endpoints: {
            import: {
                serviceOrders: 'POST /api/import/service-orders',
                schedules: 'POST /api/import/schedules',
                elders: 'POST /api/import/elders',
            },
            reconciliation: {
                start: 'POST /api/reconciliation/start',
                batches: 'GET /api/reconciliation/batches',
                batch: 'GET /api/reconciliation/batch/:batchId',
                record: 'GET /api/reconciliation/record/:recordId',
            },
            review: {
                approve: 'POST /api/review/:recordId/approve',
                reject: 'POST /api/review/:recordId/reject',
                supplement: 'POST /api/review/:recordId/supplement',
                batchApprove: 'POST /api/review/batch/approve',
                auditTrail: 'GET /api/review/:recordId/audit-trail',
                explain: 'GET /api/review/:recordId/explain',
            },
            report: {
                summary: 'GET /api/report/:batchId/summary',
                details: 'GET /api/report/:batchId/details',
                exportExcel: 'GET /api/report/:batchId/export/excel',
                exportCSV: 'GET /api/report/:batchId/export/csv',
            },
            traceability: {
                chain: 'GET /api/traceability/:recordId',
                full: 'GET /api/traceability/:recordId/full',
            },
        },
    });
});
app.use('/api', api_1.default);
app.get('/api/init-sample-data', (req, res) => {
    dataStore_1.default.clearAll();
    dataStore_1.default.saveElders(sampleData_1.sampleElders);
    dataStore_1.default.saveSchedules(sampleData_1.sampleSchedules);
    dataStore_1.default.saveServiceOrders(sampleData_1.sampleServiceOrders);
    res.json({
        message: '示例数据已初始化',
        elders: sampleData_1.sampleElders.length,
        schedules: sampleData_1.sampleSchedules.length,
        orders: sampleData_1.sampleServiceOrders.length,
    });
});
app.listen(PORT, () => {
    console.log(`护理站对账服务运行在 http://localhost:${PORT}`);
    console.log('');
    console.log('快速开始:');
    console.log('1. 初始化示例数据:');
    console.log('   GET http://localhost:3000/api/init-sample-data');
    console.log('');
    console.log('2. 开始对账:');
    console.log('   POST http://localhost:3000/api/reconciliation/start');
    console.log('   Body: { "name": "2024年5月第3周对账", "periodStart": "2024-05-20", "periodEnd": "2024-05-21", "createdBy": "站长" }');
    console.log('');
});
