const express = require('express');
const ReportService = require('../services/reportService');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();
const reportService = new ReportService();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', validate(schemas.exportReport), async (req, res, next) => {
  try {
    const { startTime, endTime, format } = req.query;

    const report = await reportService.generateReport(
      parseInt(startTime),
      parseInt(endTime)
    );

    if (format === 'csv') {
      const csv = reportService.exportToCSV(report);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=live-push-report-${Date.now()}.csv`
      );
      res.send('\uFEFF' + csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=live-push-report-${Date.now()}.json`
      );
      res.json(report);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/summary', validate(schemas.exportReport), async (req, res, next) => {
  try {
    const { startTime, endTime } = req.query;

    const report = await reportService.generateReport(
      parseInt(startTime),
      parseInt(endTime)
    );

    res.json({
      timeRange: report.timeRange,
      summary: report.summary
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
