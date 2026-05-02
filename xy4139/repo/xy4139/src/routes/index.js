const express = require('express');
const router = express.Router();

const chemicalsRouter = require('./chemicals');
const batchesRouter = require('./batches');
const requestsRouter = require('./requests');
const auditRouter = require('./audit');
const alertsRouter = require('./alerts');
const reportsRouter = require('./reports');

router.use('/chemicals', chemicalsRouter);
router.use('/batches', batchesRouter);
router.use('/requests', requestsRouter);
router.use('/audit', auditRouter);
router.use('/alerts', alertsRouter);
router.use('/reports', reportsRouter);

router.get('/docs', (req, res) => {
  res.json({
    name: '危化品领用追溯站 API',
    version: '1.0.0',
    endpoints: {
      chemicals: '/api/chemicals',
      batches: '/api/batches',
      requests: '/api/requests',
      audit: '/api/audit',
      alerts: '/api/alerts',
      reports: '/api/reports'
    },
    authentication: '使用请求头 X-User-Role 指定角色 (admin/safety_officer/user)，X-User-Id 指定用户ID'
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '危化品领用追溯站',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
