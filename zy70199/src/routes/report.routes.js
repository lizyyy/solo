const express = require('express');
const ReportService = require('../services/report.service');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  try {
    const dashboard = ReportService.getOnboardingDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee-status', (req, res) => {
  try {
    const report = ReportService.getEmployeeStatusReport(req.query);
    res.json(report);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/documents-compliance', (req, res) => {
  try {
    const report = ReportService.getDocumentsComplianceReport();
    res.json(report);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/remediation-tasks', (req, res) => {
  try {
    const report = ReportService.getRemediationTasksReport(req.query);
    res.json(report);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/history/:employeeId', (req, res) => {
  try {
    const report = ReportService.getHistoryReport(req.params.employeeId);
    res.json(report);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/validate/:employeeId', (req, res) => {
  try {
    const validation = ReportService.validateOnboardingFlow(req.params.employeeId);
    res.json(validation);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
