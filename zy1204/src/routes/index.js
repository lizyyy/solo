const express = require('express');
const router = express.Router();

const experimentsRouter = require('./experiments');
const policiesRouter = require('./policies');
const tracesRouter = require('./traces');

router.use('/api/experiments', experimentsRouter);
router.use('/api/policies', policiesRouter);
router.use('/api/traces', tracesRouter);

router.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

router.get('/api/stats', async (req, res) => {
  try {
    const { Experiment, Policy, TrafficTrace, DecisionLog } = require('../models');
    
    const [experimentCount, policyCount, traceCount, decisionLogCount] = await Promise.all([
      Experiment.count(),
      Policy.count(),
      TrafficTrace.count(),
      DecisionLog.count()
    ]);
    
    const recentExperiments = await Experiment.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    res.json({
      success: true,
      data: {
        counts: {
          experiments: experimentCount,
          policies: policyCount,
          traces: traceCount,
          decisionLogs: decisionLogCount
        },
        recentExperiments
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
