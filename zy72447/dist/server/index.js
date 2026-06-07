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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.static(path.join(__dirname, 'public')));
app.get('/api/status', (req, res) => {
    const state = store_1.defaultStore.getState();
    const byStatus = state.results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});
    res.json({
        groupRecords: state.groupRecords.length,
        contractRecords: state.contractRecords.length,
        results: state.results.length,
        logs: state.logs.length,
        batches: state.batches.length,
        lastUpdated: state.lastUpdated,
        byStatus
    });
});
app.get('/api/results', (req, res) => {
    const { status } = req.query;
    let details = store_1.defaultStore.getResultsWithDetails();
    if (status && typeof status === 'string') {
        details = details.filter((d) => d.result.status === status);
    }
    res.json(details);
});
app.get('/api/results/:id', (req, res) => {
    const { id } = req.params;
    const details = store_1.defaultStore.getResultsWithDetails();
    const found = details.find((d) => d.result.id === id);
    if (!found) {
        return res.status(404).json({ error: '未找到该记录' });
    }
    const logs = store_1.defaultStore.getLogsForEntity(id);
    res.json({ ...found, logs });
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
app.get('/api/logs', (req, res) => {
    const state = store_1.defaultStore.getState();
    res.json(state.logs.slice().reverse());
});
app.get('/api/batches', (req, res) => {
    const state = store_1.defaultStore.getState();
    res.json(state.batches.slice().reverse());
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`音频母带交付核对系统已启动: http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map