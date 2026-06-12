"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
const store_1 = require("../store");
const reconciliation_1 = require("../core/reconciliation");
const presenter_1 = require("../shared/presenter");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.static(path.join(__dirname, 'public')));
app.get('/api/status', (req, res) => {
    const state = store_1.defaultStore.getState();
    const details = store_1.defaultStore.getResultsWithDetails();
    const summary = (0, presenter_1.buildSummary)(details);
    const byStatus = {};
    for (const item of summary) {
        byStatus[item.key] = item.value;
    }
    res.json({
        groupRecords: state.groupRecords.filter((g) => g.status !== 'superseded').length,
        contractRecords: state.contractRecords.filter((c) => c.status !== 'superseded').length,
        results: details.length,
        logs: state.logs.length,
        batches: state.batches.length,
        lastUpdated: state.lastUpdated,
        byStatus,
        summary
    });
});
app.get('/api/results', (req, res) => {
    const { status } = req.query;
    let details = store_1.defaultStore.getResultsWithDetails();
    if (status && typeof status === 'string') {
        details = details.filter((d) => d.result.status === status);
    }
    const rows = details.map(({ result, groupRecord, contractRecord }) => ({
        ...(0, presenter_1.buildDetailRow)(result, groupRecord, contractRecord),
        result,
        groupRecord,
        contractRecord
    }));
    res.json(rows);
});
app.get('/api/results/:id', (req, res) => {
    const { id } = req.params;
    const details = store_1.defaultStore.getResultsWithDetails();
    const found = details.find((d) => d.result.id === id);
    if (!found) {
        return res.status(404).json({ error: '未找到该记录' });
    }
    const logs = store_1.defaultStore.getLogsForEntity(id);
    const detailRow = (0, presenter_1.buildDetailRow)(found.result, found.groupRecord, found.contractRecord);
    const logRows = logs.map(presenter_1.buildLogRow);
    res.json({
        ...detailRow,
        result: found.result,
        groupRecord: found.groupRecord,
        contractRecord: found.contractRecord,
        logs: logRows,
        rawLogs: logs
    });
});
app.post('/api/results/:id/confirm', (req, res) => {
    const { id } = req.params;
    const { operator = 'web', notes } = req.body;
    const result = (0, reconciliation_1.confirmResult)(store_1.defaultStore, id, operator, notes);
    if (!result) {
        return res.status(404).json({ error: '未找到该记录' });
    }
    res.json(result);
});
app.post('/api/results/:id/reject', (req, res) => {
    const { id } = req.params;
    const { operator = 'web', notes } = req.body;
    const result = (0, reconciliation_1.rejectResult)(store_1.defaultStore, id, operator, notes);
    if (!result) {
        return res.status(404).json({ error: '未找到该记录' });
    }
    res.json(result);
});
app.post('/api/results/:id/rollback', (req, res) => {
    const { id } = req.params;
    const { operator = 'web', reason } = req.body;
    const result = (0, reconciliation_1.rollbackResult)(store_1.defaultStore, id, operator, reason);
    if (!result) {
        return res.status(404).json({ error: '未找到该记录' });
    }
    res.json(result);
});
app.post('/api/reconcile', (req, res) => {
    const { operator = 'web', lateBatchId, force = false } = req.body;
    const result = (0, reconciliation_1.runReconciliation)(store_1.defaultStore, operator, {
        lateContractBatchId: lateBatchId,
        preserveConfirmed: !force
    });
    res.json(result);
});
app.post('/api/batches/:id/rollback', (req, res) => {
    const { id } = req.params;
    const { operator = 'web', reason } = req.body;
    try {
        const result = store_1.defaultStore.rollbackBatch(id, operator, reason);
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.get('/api/logs', (req, res) => {
    const state = store_1.defaultStore.getState();
    const rows = state.logs.slice().reverse().map(presenter_1.buildLogRow);
    res.json(rows);
});
app.get('/api/batches', (req, res) => {
    const state = store_1.defaultStore.getState();
    res.json(state.batches.slice().reverse());
});
app.get('/api/export-preview', (req, res) => {
    const details = store_1.defaultStore.getResultsWithDetails();
    const detailRows = details.map(({ result, groupRecord, contractRecord }) => (0, presenter_1.buildDetailRow)(result, groupRecord, contractRecord));
    const exportRows = detailRows.map(presenter_1.detailRowToExportColumns);
    const summaryItems = (0, presenter_1.buildSummary)(details);
    res.json({
        count: exportRows.length,
        columns: Object.keys(exportRows[0] || {}),
        rows: exportRows,
        detailRows,
        summary: summaryItems
    });
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`音频母带交付核对系统已启动: http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map