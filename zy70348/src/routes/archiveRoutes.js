const express = require('express');
const router = express.Router();
const archiveService = require('../services/archiveService');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'archive-retention-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/policies', (req, res) => {
  try {
    const policies = archiveService.listRetentionPolicies();
    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/freezes', (req, res) => {
  try {
    const freezes = archiveService.listFreezes();
    res.json({
      success: true,
      data: freezes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const tasks = archiveService.listArchiveTasks();
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks', (req, res) => {
  try {
    const { dataType, dateRangeStart, dateRangeEnd, operationType, operator } = req.body;
    
    if (!dataType || !dateRangeStart || !dateRangeEnd || !operationType) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: dataType, dateRangeStart, dateRangeEnd, operationType'
      });
    }

    const result = archiveService.createArchiveTask({
      dataType,
      dateRangeStart: Number(dateRangeStart),
      dateRangeEnd: Number(dateRangeEnd),
      operationType
    }, operator || 'system');

    res.status(result.idempotent ? 200 : 201).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/execute', (req, res) => {
  try {
    const { taskId } = req.params;
    const simulateFailure = req.body.simulateFailure === true;

    const result = archiveService.executeArchiveTask(taskId, simulateFailure);
    
    if (result.success) {
      res.json({ success: true, ...result });
    } else {
      res.status(500).json({ success: false, ...result });
    }
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/retry', (req, res) => {
  try {
    const { taskId } = req.params;
    const result = archiveService.retryFailedTask(taskId);
    
    if (result.success) {
      res.json({ success: true, ...result });
    } else {
      res.status(400).json({ success: false, ...result });
    }
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const details = archiveService.getTaskDetails(taskId);
    
    if (!details) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recovery-requests', (req, res) => {
  try {
    const requests = archiveService.listRecoveryRequests();
    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/recovery-requests', (req, res) => {
  try {
    const { dataType, recordIds, reason, operator } = req.body;
    
    if (!dataType || !recordIds || !reason) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: dataType, recordIds, reason'
      });
    }

    const result = archiveService.createRecoveryRequest({
      dataType,
      recordIds,
      reason
    }, operator || 'unknown');

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/recovery-requests/:requestId/approve', (req, res) => {
  try {
    const { requestId } = req.params;
    const { approved, approver, comment } = req.body;
    
    if (approved === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: approved (true/false)'
      });
    }

    const result = archiveService.approveRecoveryRequest(
      requestId,
      approver || 'admin',
      approved,
      comment || ''
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/report', (req, res) => {
  try {
    const report = archiveService.getArchiveReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', (req, res) => {
  try {
    const logs = archiveService.getAuditLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/record-status/:dataType/:recordId', (req, res) => {
  try {
    const { dataType, recordId } = req.params;
    const status = archiveService.getRecordStatus(recordId, dataType);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
