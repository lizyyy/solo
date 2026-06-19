import express from 'express';
import cors from 'cors';
import path from 'path';
import { fittingService } from '../services/FittingService';
import type { FittingMethod, SampleSource } from '../models/types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/sessions', (req, res) => {
  const { name, createdBy } = req.body;
  if (!name || !createdBy) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  const session = fittingService.createSession(name, createdBy);
  res.json(session);
});

app.get('/api/sessions', (req, res) => {
  const sessions = fittingService.getAllSessions();
  res.json(sessions);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = fittingService.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }
  res.json(session);
});

app.post('/api/sessions/:id/samples', (req, res) => {
  const { id } = req.params;
  const { samples, addedBy } = req.body;
  try {
    const result = fittingService.addSamples(id, samples, addedBy);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/sessions/:id/fitting', (req, res) => {
  const { id } = req.params;
  const { method, calculatedBy, excludeAnomalies, degree } = req.body;
  try {
    const result = fittingService.runFitting(
      id,
      method as FittingMethod,
      calculatedBy,
      excludeAnomalies ?? true,
      degree
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/sessions/:id/samples/:sampleId/confirm', (req, res) => {
  const { id, sampleId } = req.params;
  const { confirmedBy } = req.body;
  try {
    const result = fittingService.confirmSample(id, sampleId, confirmedBy);
    if (!result) {
      return res.status(404).json({ error: '样本不存在' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/sessions/:id/samples/:sampleId/withdraw', (req, res) => {
  const { id, sampleId } = req.params;
  const { withdrawnBy, reason } = req.body;
  try {
    const result = fittingService.withdrawSample(id, sampleId, withdrawnBy, reason);
    if (!result) {
      return res.status(404).json({ error: '样本不存在' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.put('/api/sessions/:id/samples/:sampleId', (req, res) => {
  const { id, sampleId } = req.params;
  const { field, newValue, changedBy, reason } = req.body;
  try {
    const result = fittingService.updateSample(id, sampleId, field, newValue, changedBy, reason);
    if (!result) {
      return res.status(404).json({ error: '样本不存在' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/sessions/:id/samples/:sampleId/history', (req, res) => {
  const { id, sampleId } = req.params;
  try {
    const result = fittingService.getSampleHistory(id, sampleId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/sessions/:id/samples/:sampleId/diffs', (req, res) => {
  const { id, sampleId } = req.params;
  try {
    const result = fittingService.getConfirmationDiffs(id, sampleId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/sessions/:id/replay-withdrawn', (req, res) => {
  const { id } = req.params;
  const { withdrawnSampleId, method, calculatedBy, degree } = req.body;
  try {
    const result = fittingService.replayWithWithdrawn(
      id,
      withdrawnSampleId,
      method as FittingMethod,
      calculatedBy,
      degree
    );
    if (!result) {
      return res.status(404).json({ error: '撤回样本不存在或状态不正确' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/sessions/:id/fitting/:fittingId/verify', (req, res) => {
  const { id, fittingId } = req.params;
  try {
    const result = fittingService.verifyConsistency(id, fittingId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/sessions/:id/anomalies', (req, res) => {
  const { id } = req.params;
  try {
    const result = fittingService.getAnomalySummary(id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`曲线拟合参数回放工具已启动: http://localhost:${PORT}`);
});

export default app;
