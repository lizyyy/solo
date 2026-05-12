const express = require('express');
const router = express.Router();

const conversationsRouter = require('./conversations');
const escalationsRouter = require('./escalations');
const processingRouter = require('./processing');
const reportsRouter = require('./reports');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '客服机器人转人工 API'
  });
});

router.use('/conversations', conversationsRouter);
router.use('/escalations', escalationsRouter);
router.use('/processing', processingRouter);
router.use('/reports', reportsRouter);

module.exports = router;
