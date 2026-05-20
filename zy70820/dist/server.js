"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const DataStore_1 = require("./store/DataStore");
const ImportService_1 = require("./services/ImportService");
const BusinessService_1 = require("./services/BusinessService");
const QueryService_1 = require("./services/QueryService");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '社区疫苗预约服务运行正常' });
});
app.post('/api/batches', (req, res) => {
    try {
        const { batchNo, name, vaccineCode, vaccineName, createdBy } = req.body;
        const batch = DataStore_1.dataStore.createBatch({
            batchNo,
            name,
            vaccineCode,
            vaccineName,
            totalCount: 0,
            processedCount: 0,
            status: 'active',
            createdBy: createdBy || 'admin'
        });
        res.json({ success: true, data: batch });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/batches', (req, res) => {
    try {
        const batches = DataStore_1.dataStore.getBatches();
        res.json({ success: true, data: batches });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/batches/:id', (req, res) => {
    try {
        const batch = DataStore_1.dataStore.getBatchById(req.params.id);
        if (!batch) {
            return res.status(404).json({ success: false, error: '批次不存在' });
        }
        const statistics = QueryService_1.queryService.getStatisticsByBatch(req.params.id);
        res.json({ success: true, data: { ...batch, statistics } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/import/appointments', async (req, res) => {
    try {
        const { csvContent, batchId } = req.body;
        if (!csvContent || !batchId) {
            return res.status(400).json({ success: false, error: '缺少CSV内容或批次ID' });
        }
        const result = await ImportService_1.importService.importAppointmentsFromCSVString(csvContent, batchId);
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (batch) {
            DataStore_1.dataStore.updateBatch(batchId, {
                totalCount: batch.totalCount + result.imported
            });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/import/inventory', (req, res) => {
    try {
        const { jsonContent } = req.body;
        if (!jsonContent) {
            return res.status(400).json({ success: false, error: '缺少JSON内容' });
        }
        const result = ImportService_1.importService.importVaccineInventoryFromJSON(jsonContent);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/import/contraindications', (req, res) => {
    try {
        const { jsonContent } = req.body;
        if (!jsonContent) {
            return res.status(400).json({ success: false, error: '缺少JSON内容' });
        }
        const result = ImportService_1.importService.importContraindicationRules(jsonContent);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/records/:id/process', (req, res) => {
    try {
        const { operator } = req.body;
        const result = BusinessService_1.businessService.processAppointmentRecord(req.params.id, operator || 'admin');
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.reason });
        }
        res.json({ success: true, data: result.record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/batches/:id/process-all', (req, res) => {
    try {
        const { operator } = req.body;
        const result = BusinessService_1.businessService.processBatchRecords(req.params.id, operator || 'admin');
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/records/:id/return', (req, res) => {
    try {
        const { operator, reason } = req.body;
        const result = BusinessService_1.businessService.returnToPending(req.params.id, operator || 'admin', reason);
        if (!result.success) {
            return res.status(400).json({ success: false, error: '退回失败' });
        }
        res.json({ success: true, data: result.record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/records/:id/mark-processed', (req, res) => {
    try {
        const { operator } = req.body;
        const result = BusinessService_1.businessService.markAsProcessed(req.params.id, operator || 'admin');
        if (!result.success) {
            return res.status(400).json({ success: false, error: '标记失败' });
        }
        res.json({ success: true, data: result.record });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/records', (req, res) => {
    try {
        const { childIdCard, childName, vaccineCode, batchId, status, startDate, endDate, waitlistOrder } = req.query;
        const filters = {
            childIdCard: childIdCard,
            childName: childName,
            vaccineCode: vaccineCode,
            batchId: batchId,
            status: status,
            startDate: startDate,
            endDate: endDate,
            waitlistOrder: waitlistOrder ? parseInt(waitlistOrder) : undefined
        };
        const records = QueryService_1.queryService.queryRecords(filters);
        res.json({ success: true, count: records.length, data: records });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/records/:id', (req, res) => {
    try {
        const result = QueryService_1.queryService.getRecordWithTraceability(req.params.id);
        if (!result.record) {
            return res.status(404).json({ success: false, error: '记录不存在' });
        }
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/export/records', (req, res) => {
    try {
        const { childIdCard, childName, vaccineCode, batchId, status, startDate, endDate } = req.query;
        const filters = {
            childIdCard: childIdCard,
            childName: childName,
            vaccineCode: vaccineCode,
            batchId: batchId,
            status: status,
            startDate: startDate,
            endDate: endDate
        };
        const records = QueryService_1.queryService.queryRecords(filters);
        const csv = QueryService_1.queryService.exportToCSV(records);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="appointments_${Date.now()}.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/export/records/:id/traceability', (req, res) => {
    try {
        const csv = QueryService_1.queryService.exportWithTraceability(req.params.id);
        if (!csv) {
            return res.status(404).json({ success: false, error: '记录不存在' });
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="traceability_${req.params.id}.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/children/:idCard/history', (req, res) => {
    try {
        const history = QueryService_1.queryService.getHistoryByChild(req.params.idCard);
        res.json({ success: true, count: history.length, data: history });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/batches/:id/waitlist', (req, res) => {
    try {
        const waitlist = QueryService_1.queryService.getWaitlistByBatch(req.params.id);
        res.json({ success: true, count: waitlist.length, data: waitlist });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/batches/:id/waitlist/traceability', (req, res) => {
    try {
        const traceability = BusinessService_1.businessService.getWaitlistTraceability(req.params.id);
        res.json({ success: true, count: traceability.length, data: traceability });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/inventory', (req, res) => {
    try {
        const inventory = DataStore_1.dataStore.getVaccineInventories();
        res.json({ success: true, count: inventory.length, data: inventory });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/contraindications', (req, res) => {
    try {
        const rules = DataStore_1.dataStore.getContraindicationRules();
        res.json({ success: true, count: rules.length, data: rules });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`社区疫苗预约服务已启动，端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`数据文件将保存在: ${process.cwd()}/data/data.json`);
});
exports.default = app;
