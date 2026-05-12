const express = require('express');
const router = express.Router();
const orderController = require('../controllers/OrderController');

router.post('/', orderController.createOrder);

router.post('/:orderId/events', orderController.appendEvent);

router.get('/:orderId/timeline', orderController.getTimeline);

router.post('/:orderId/replay', orderController.replayToPoint);

router.post('/:orderId/rebuild', orderController.rebuildProjection);

router.get('/:orderId/projection', orderController.getProjection);

router.get('/:orderId/consistency', orderController.checkConsistency);

router.get('/:orderId/report', orderController.getExplanationReport);

router.get('/:orderId/report/export', orderController.exportReportAsText);

router.post('/:orderId/compensation', orderController.appendCompensationEvent);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '订单事件溯源 API',
    endpoints: {
      'POST /api/orders': '创建订单',
      'POST /api/orders/:orderId/events': '追加事件',
      'GET /api/orders/:orderId/timeline': '查看订单时间线',
      'POST /api/orders/:orderId/replay': '回放事件到指定点',
      'POST /api/orders/:orderId/rebuild': '重建投影',
      'GET /api/orders/:orderId/projection': '获取当前投影',
      'GET /api/orders/:orderId/consistency': '检查一致性',
      'GET /api/orders/:orderId/report': '获取解释报告',
      'GET /api/orders/:orderId/report/export': '导出文本报告',
      'POST /api/orders/:orderId/compensation': '追加补偿事件'
    }
  });
});

module.exports = router;
