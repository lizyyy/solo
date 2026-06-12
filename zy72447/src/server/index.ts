import express from 'express';
import * as path from 'path';
import { defaultStore } from '../store';
import { runReconciliation, confirmResult, rejectResult, rollbackResult } from '../core/reconciliation';
import { importGroupSignupFile } from '../importers/group-signup';
import { importContractFile } from '../importers/contract-screenshot';
import {
  buildDetailRow,
  buildSummary,
  buildLogRow,
  detailRowToExportColumns,
  STATUS_LABELS,
  REASON_LABELS,
  FIELD_LABELS
} from '../shared/presenter';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  const state = defaultStore.getState();
  const details = defaultStore.getResultsWithDetails();
  const summary = buildSummary(details);

  const byStatus: Record<string, number> = {};
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
  let details = defaultStore.getResultsWithDetails();

  if (status && typeof status === 'string') {
    details = details.filter((d) => d.result.status === status);
  }

  const rows = details.map(({ result, groupRecord, contractRecord }) => ({
    ...buildDetailRow(result, groupRecord, contractRecord),
    result,
    groupRecord,
    contractRecord
  }));

  res.json(rows);
});

app.get('/api/results/:id', (req, res) => {
  const { id } = req.params;
  const details = defaultStore.getResultsWithDetails();
  const found = details.find((d) => d.result.id === id);

  if (!found) {
    return res.status(404).json({ error: '未找到该记录' });
  }

  const logs = defaultStore.getLogsForEntity(id);
  const detailRow = buildDetailRow(found.result, found.groupRecord, found.contractRecord);
  const logRows = logs.map(buildLogRow);

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

app.post('/api/batches/:id/rollback', (req, res) => {
  const { id } = req.params;
  const { operator = 'web', reason } = req.body;

  try {
    const result = defaultStore.rollbackBatch(id, operator, reason);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/logs', (req, res) => {
  const state = defaultStore.getState();
  const rows = state.logs.slice().reverse().map(buildLogRow);
  res.json(rows);
});

app.get('/api/batches', (req, res) => {
  const state = defaultStore.getState();
  res.json(state.batches.slice().reverse());
});

app.get('/api/export-preview', (req, res) => {
  const details = defaultStore.getResultsWithDetails();
  const detailRows = details.map(({ result, groupRecord, contractRecord }) =>
    buildDetailRow(result, groupRecord, contractRecord)
  );
  const exportRows = detailRows.map(detailRowToExportColumns);
  const summaryItems = buildSummary(details);

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

export default app;
