const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const detourService = require('../services/detourService');

router.get('/detour/:id/json', (req, res, next) => {
  try {
    const report = detourService.generateReport(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=detour-report-${req.params.id}.json`);
    res.send(JSON.stringify(report, null, 2));
  } catch (err) {
    next(err);
  }
});

router.get('/detour/:id/csv', (req, res, next) => {
  try {
    const report = detourService.generateReport(req.params.id);
    
    const receiptFields = [
      'student_name',
      'parent_phone',
      'confirm_type',
      'message',
      'is_late',
      'late_reason',
      'source',
      'created_at'
    ];

    const json2csvParser = new Parser({ fields: receiptFields });
    const csv = json2csvParser.parse(report.receipts);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=detour-receipts-${req.params.id}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

router.get('/detour/:id/full-csv', (req, res, next) => {
  try {
    const report = detourService.generateReport(req.params.id);
    
    const summaryData = [{
      plan_id: report.plan_info.id,
      route_name: report.plan_info.route_name,
      reason_name: report.plan_info.reason_name,
      plan_date: report.plan_info.plan_date,
      status: report.plan_info.status,
      estimated_delay: report.plan_info.estimated_delay,
      total_affected_students: report.statistics.total_affected_students,
      confirmed_receipts: report.statistics.confirmed_receipts,
      pending_receipts: report.statistics.pending_receipts,
      late_count: report.statistics.late_count,
      confirmation_rate: report.statistics.confirmation_rate + '%'
    }];

    const summaryParser = new Parser({ fields: Object.keys(summaryData[0]) });
    const summaryCsv = summaryParser.parse(summaryData);

    const receiptFields = ['student_name', 'parent_phone', 'confirm_type', 'is_late', 'late_reason', 'created_at'];
    const receiptParser = new Parser({ fields: receiptFields });
    const receiptsCsv = receiptParser.parse(report.receipts);

    const fullCsv = `=== 改线计划摘要 ===\n${summaryCsv}\n\n=== 家长回执明细 ===\n${receiptsCsv}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=detour-full-report-${req.params.id}.csv`);
    res.send('\uFEFF' + fullCsv);
  } catch (err) {
    next(err);
  }
});

router.get('/error-logs', (req, res) => {
  const logs = detourService.getErrorLogs();
  res.json({ success: true, data: logs });
});

module.exports = router;
