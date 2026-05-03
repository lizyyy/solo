const express = require('express');
const router = express.Router();

// 导入各个路由模块
const equipmentRouter = require('./equipment');
const recallRouter = require('./recall');
const workOrderRouter = require('./workOrder');
const importRouter = require('./import');
const riskRouter = require('./risk');
const exportRouter = require('./export');
const rulesRouter = require('./rules');

// 健康检查接口
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '灭火器批次召回闭环台服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 注册路由
router.use('/equipment', equipmentRouter);
router.use('/recall', recallRouter);
router.use('/work-order', workOrderRouter);
router.use('/import', importRouter);
router.use('/risk', riskRouter);
router.use('/export', exportRouter);
router.use('/rules', rulesRouter);

module.exports = router;
