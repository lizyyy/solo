const express = require('express');
const ReportController = require('../controllers/report.controller');

const router = express.Router();
const controller = new ReportController();

router.get('/departments', (req, res) => controller.getAllDepartmentsReport(req, res));
router.get('/departments/:departmentId', (req, res) => controller.getDepartmentReport(req, res));
router.get('/departments/:departmentId/trend', (req, res) => controller.getBudgetTrend(req, res));

module.exports = router;
