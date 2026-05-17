const express = require('express');
const router = express.Router();
const fs = require('fs');

module.exports = (replayService, exportService) => {
  router.post('/permissions', (req, res) => {
    try {
      const permission = replayService.createReplayPermission(req.body);
      res.json({ success: true, data: permission });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/permissions', (req, res) => {
    try {
      const filters = req.query;
      const permissions = replayService.getPermissionList(filters);
      res.json({ success: true, data: permissions, count: permissions.length });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/permissions/:id', (req, res) => {
    try {
      const detail = replayService.getPermissionDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ success: false, error: '回放权限不存在' });
      }
      res.json({ success: true, data: detail });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/permissions/:id/unlock', (req, res) => {
    try {
      const { operator, source } = req.body;
      const updated = replayService.verifyAndUnlock(req.params.id, operator, source);
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/permissions/:id/revoke', (req, res) => {
    try {
      const { operator, reason, source } = req.body;
      const updated = replayService.revokePermission(req.params.id, operator, reason, source);
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/permissions/:id/expire', (req, res) => {
    try {
      const { operator } = req.body;
      const updated = replayService.expirePermission(req.params.id, operator);
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/permissions/:id/history', (req, res) => {
    try {
      const history = replayService.getHistory(req.params.id);
      res.json({ success: true, data: history, count: history.length });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/import', (req, res) => {
    try {
      const { records, operator } = req.body;
      const results = replayService.batchImport(records, operator);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/bad-records', (req, res) => {
    try {
      const badRecords = replayService.store.getAll('badRecords');
      res.json({ success: true, data: badRecords, count: badRecords.length });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/export/permissions', async (req, res) => {
    try {
      const result = await exportService.exportReplayPermissions(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/export/permissions/:id/download', async (req, res) => {
    try {
      const result = await exportService.exportHistory(req.params.id);
      res.download(result.filePath, result.fileName);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/export/bad-records', async (req, res) => {
    try {
      const result = await exportService.exportBadRecords();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/orders', (req, res) => {
    try {
      const order = replayService.createOrder(req.body);
      res.json({ success: true, data: order });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/sessions', (req, res) => {
    try {
      const session = replayService.createLiveSession(req.body);
      res.json({ success: true, data: session });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
};
