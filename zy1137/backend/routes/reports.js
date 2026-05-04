const express = require('express');
const ReportGenerator = require('../services/reportGenerator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { 
    format = 'json',
    include_high_risk = 'true',
    include_zone_issues = 'true',
    include_pairing_failures = 'true',
    include_pending_actions = 'true',
    start_time,
    end_time
  } = req.query;

  const generator = new ReportGenerator();
  
  const timeRange = start_time && end_time ? {
    start: new Date(start_time),
    end: new Date(end_time)
  } : null;

  if (format.toLowerCase() === 'json') {
    const reportData = await generator.generateReport({
      format: 'markdown',
      includeHighRisk: include_high_risk === 'true',
      includeZoneIssues: include_zone_issues === 'true',
      includePairingFailures: include_pairing_failures === 'true',
      includePendingActions: include_pending_actions === 'true',
      timeRange
    });

    return sendSuccess(res, {
      reportData: {
        summary: reportData.summary,
        highRiskDevices: reportData.highRiskDevices,
        zoneIssues: reportData.zoneIssues,
        pairingFailures: reportData.pairingFailures,
        pendingActions: reportData.pendingActions,
        statistics: reportData.statistics
      },
      generatedAt: reportData.generatedAt
    }, '获取报告数据成功');
  }

  const content = await generator.generateReport({
    format: format.toLowerCase(),
    includeHighRisk: include_high_risk === 'true',
    includeZoneIssues: include_zone_issues === 'true',
    includePairingFailures: include_pairing_failures === 'true',
    includePendingActions: include_pending_actions === 'true',
    timeRange
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  
  switch (format.toLowerCase()) {
    case 'markdown':
    case 'md':
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=ble-inspection-report-${timestamp}.md`);
      return res.send(content);
    
    case 'html':
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=ble-inspection-report-${timestamp}.html`);
      return res.send(content);
    
    case 'csv':
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=ble-inspection-report-${timestamp}.csv`);
      return res.send(content);
    
    default:
      throw new AppError('不支持的报告格式', 400, 'INVALID_FORMAT');
  }
}));

router.get('/preview', asyncHandler(async (req, res) => {
  const { 
    include_high_risk = 'true',
    include_zone_issues = 'true',
    include_pairing_failures = 'true',
    include_pending_actions = 'true'
  } = req.query;

  const generator = new ReportGenerator();
  
  const htmlContent = await generator.generateReport({
    format: 'html',
    includeHighRisk: include_high_risk === 'true',
    includeZoneIssues: include_zone_issues === 'true',
    includePairingFailures: include_pairing_failures === 'true',
    includePendingActions: include_pending_actions === 'true'
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(htmlContent);
}));

router.post('/email', asyncHandler(async (req, res) => {
  const { 
    recipients,
    format = 'html',
    include_high_risk = true,
    include_zone_issues = true,
    include_pairing_failures = true,
    include_pending_actions = true
  } = req.body;

  if (!recipients || recipients.length === 0) {
    throw new AppError('请指定收件人', 400, 'MISSING_RECIPIENTS');
  }

  const generator = new ReportGenerator();
  
  const content = await generator.generateReport({
    format: format.toLowerCase(),
    includeHighRisk: include_high_risk,
    includeZoneIssues: include_zone_issues,
    includePairingFailures: include_pairing_failures,
    includePendingActions: include_pending_actions
  });

  return sendSuccess(res, {
    sent: false,
    message: '邮件发送功能需要配置SMTP服务，当前仅返回报告内容',
    recipients,
    format,
    contentLength: content.length
  }, '报告已生成（邮件发送功能待配置）');
}));

module.exports = router;
