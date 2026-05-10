const express = require('express');
const ReportService = require('../services/reportService');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await ReportService.getProbationDashboard();
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-reviews', async (req, res, next) => {
  try {
    const report = await ReportService.getPendingReviewsReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

router.get('/salary-adjustments', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await ReportService.getSalaryAdjustmentReport(startDate, endDate);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

router.get('/confirmation-history', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await ReportService.getConfirmationHistoryReport(startDate, endDate);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit/employee/:employeeId', async (req, res, next) => {
  try {
    const trail = await ReportService.getEmployeeAuditTrail(req.params.employeeId);
    
    res.json({
      success: true,
      data: trail
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit/probation/:probationPlanId', async (req, res, next) => {
  try {
    const trail = await ReportService.getProbationAuditTrail(req.params.probationPlanId);
    
    res.json({
      success: true,
      data: trail
    });
  } catch (error) {
    next(error);
  }
});

router.get('/rules', async (req, res, next) => {
  try {
    const rules = ReportService.getSystemRules();
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
