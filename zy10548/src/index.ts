import express from 'express';
import { syncService } from './service';
import { FailureType } from './models';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sync-pause-api', timestamp: new Date().toISOString() });
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = await syncService.createSyncTask(req.body);
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await syncService.listSyncTasks();
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await syncService.getSyncTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pause-windows', async (req, res) => {
  try {
    const window = await syncService.createPauseWindow(req.body);
    res.status(201).json(window);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tasks/:taskId/pause-windows', async (req, res) => {
  try {
    const windows = await syncService.listPauseWindows(req.params.taskId);
    res.json(windows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pause-windows/:id', async (req, res) => {
  try {
    const window = await syncService.getPauseWindow(req.params.id);
    if (!window) {
      return res.status(404).json({ error: 'Pause window not found' });
    }
    res.json(window);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pause-windows/:id/activate', async (req, res) => {
  try {
    const window = await syncService.activatePauseWindow(req.params.id);
    res.json(window);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pause-windows/:id/end', async (req, res) => {
  try {
    const result = await syncService.endPauseWindow(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pause-windows/:id/cancel', async (req, res) => {
  try {
    const window = await syncService.cancelPauseWindow(req.params.id);
    res.json(window);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/recovery', async (req, res) => {
  try {
    const action = await syncService.startRecovery(req.body);
    res.status(201).json(action);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tasks/:taskId/recovery', async (req, res) => {
  try {
    const actions = await syncService.listRecoveryActions(req.params.taskId);
    res.json(actions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/recovery/:id', async (req, res) => {
  try {
    const action = await syncService.getRecoveryAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Recovery action not found' });
    }
    res.json(action);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/failures', async (req, res) => {
  try {
    const { syncTaskId, failureType, errorMessage, originalInput, processingBasis, ...options } = req.body;
    const failure = await syncService.recordFailure(
      syncTaskId,
      failureType as FailureType,
      errorMessage,
      originalInput,
      processingBasis,
      options
    );
    res.status(201).json(failure);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tasks/:taskId/failures', async (req, res) => {
  try {
    const failures = await syncService.listFailureDetails(req.params.taskId);
    res.json(failures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/failures/:id', async (req, res) => {
  try {
    const failure = await syncService.getFailureDetail(req.params.id);
    if (!failure) {
      return res.status(404).json({ error: 'Failure detail not found' });
    }
    res.json(failure);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/failures/:id/correct', async (req, res) => {
  try {
    const result = await syncService.applyManualCorrection({
      failureId: req.params.id,
      ...req.body
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/backlog', async (req, res) => {
  try {
    const { pendingDelta, processingDelta, failedDelta } = req.body;
    const task = await syncService.updateBacklogStats(
      req.params.id,
      pendingDelta || 0,
      processingDelta || 0,
      failedDelta || 0
    );
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { syncTaskId, reportType, generatedBy, pauseWindowId } = req.body;
    const report = await syncService.generateReport(syncTaskId, reportType, generatedBy, pauseWindowId);
    res.status(201).json(report);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tasks/:taskId/reports', async (req, res) => {
  try {
    const reports = await syncService.listSyncReports(req.params.taskId);
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await syncService.getSyncReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/:id/export/json', async (req, res) => {
  try {
    const filePath = await syncService.exportReportToJson(req.params.id);
    res.json({ success: true, filePath });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reports/:id/export/csv', async (req, res) => {
  try {
    const filePath = await syncService.exportReportToCsv(req.params.id);
    res.json({ success: true, filePath });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sync Pause API running on http://localhost:${PORT}`);
  console.log('Health check: http://localhost:${PORT}/health');
});

export default app;
