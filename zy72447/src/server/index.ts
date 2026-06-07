import express from 'express';
import * as path from 'path';
import { defaultStore } from '../store';
import { runReconciliation, confirmResult, rejectResult, rollbackResult } from '../core/reconciliation';
import { importGroupSignupFile } from '../importers/group-signup';
import { importContractFile } from '../importers/contract-screenshot';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  const state = defaultStore.getState();
  const byStatus = state.results.reduce((acc: Record<string, number>, r) => {
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
  let details = defaultStore.getResultsWithDetails();

  if (status && typeof status === 'string') {
    details = details.filter((d) => d.result.status === status);
  }

  res.json(details);
});

app.get('/api/results/:id', (req, res) => {
  const { id } = req.params;
  const details = defaultStore.getResultsWithDetails();
  const found = details.find((d) => d.result.id === id);

  if (!found) {
    return res.status(404).json({ error: '未找到该记录' });
  }

  const logs = defaultStore.getLogsForEntity(id);
  res.json({ ...found, logs });
});

app.post('/api/results/:id/confirm', (req, res) => {
  const { id } = req.params;
  const { operator = 'web', notes } = req.body;
  const result = confirmResult(defaultStore, id, operator, notes);

  if (!result) {
    return res.status(404).json({ error: '未找到该记录' });
  }

  res.json(result);
});

app.post('/api/results/:id/reject', (req, res) => {
  const { id } = req.params;
  const { operator = 'web', notes } = req.body;
  const result = rejectResult(defaultStore, id, operator, notes);

  if (!result) {
    return res.status(404).json({ error: '未找到该记录' });
  }

  res.json(result);
});

app.post('/api/results/:id/rollback', (req, res) => {
  const { id } = req.params;
  const { operator = 'web', reason } = req.body;
  const result = rollbackResult(defaultStore, id, operator, reason);

  if (!result) {
    return res.status(404).json({ error: '未找到该记录' });
  }

  res.json(result);
});

app.post('/api/reconcile', (req, res) => {
  const { operator = 'web', lateBatchId, force = false } = req.body;
  const result = runReconciliation(defaultStore, operator, {
    lateContractBatchId: lateBatchId,
    preserveConfirmed: !force
  });
  res.json(result);
});

app.get('/api/logs', (req, res) => {
  const state = defaultStore.getState();
  res.json(state.logs.slice().reverse());
});

app.get('/api/batches', (req, res) => {
  const state = defaultStore.getState();
  res.json(state.batches.slice().reverse());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`音频母带交付核对系统已启动: http://localhost:${PORT}`);
});

export default app;
