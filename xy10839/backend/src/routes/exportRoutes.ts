import express from 'express';
import ExportService from '../services/ExportService';
import type { ExportStatus } from '../types';

const router = express.Router();

router.get('/tenants', (req, res) => {
  try {
    const tenants = ExportService.getTenants();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const { tenantId, status } = req.query;
    const tasks = ExportService.getTaskList(
      tenantId as string | undefined,
      status as ExportStatus | undefined
    );
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const detail = ExportService.getTaskDetail(taskId);
    res.json({ success: true, data: detail });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const result = await ExportService.createTask(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/retry', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await ExportService.retryTask(taskId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/download-token', (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const result = ExportService.generateDownloadToken(taskId, userId || 'anonymous', clientIp, userAgent);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId/certificate', (req, res) => {
  try {
    const { taskId } = req.params;
    const certificate = ExportService.getCertificate(taskId);
    res.json({ success: true, data: certificate });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

export default router;
