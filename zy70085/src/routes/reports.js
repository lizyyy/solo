const express = require('express');
const { ReportService, TaskService, StateConsistencyService } = require('../services');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const stats = await ReportService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status-breakdown', async (req, res) => {
  try {
    const breakdown = await ReportService.getApplicationStatusBreakdown();
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/road-utilization', async (req, res) => {
  try {
    const utilization = await ReportService.getRoadSectionUtilization();
    res.json({ success: true, data: utilization });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/overdue', async (req, res) => {
  try {
    const report = await ReportService.getOverdueReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/inspections', async (req, res) => {
  try {
    const report = await ReportService.getInspectionReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/contractor/:contractorId', async (req, res) => {
  try {
    const stats = await ReportService.getContractorStatistics(req.params.contractorId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/repair-status/:applicationId', async (req, res) => {
  try {
    const result = await StateConsistencyService.verifyAndRepairApplication(
      req.params.applicationId,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/repair-all', async (req, res) => {
  try {
    const results = await StateConsistencyService.repairAllInconsistentApplications(
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: results, repairedCount: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/run-tasks', async (req, res) => {
  try {
    const batchSize = parseInt(req.query.batchSize) || 10;
    const results = await TaskService.runPendingTasks(batchSize);
    res.json({
      success: true,
      executedCount: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/retry', async (req, res) => {
  try {
    const task = await TaskService.retryTask(req.params.taskId);
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks/failed', async (req, res) => {
  try {
    const tasks = await TaskService.listFailedTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/retryable', async (req, res) => {
  try {
    const tasks = await TaskService.listRetryableTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/full', async (req, res) => {
  try {
    const report = await ReportService.generateFullReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
