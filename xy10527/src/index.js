const express = require('express');
const logger = require('./utils/logger');
const orderRoutes = require('./routes/orderRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const { initializeSampleData } = require('./data/sampleData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ success: true, message: '社区团购缺斤赔付API服务运行中', timestamp: new Date().toISOString() });
});

app.use('/api/orders', orderRoutes);
app.use('/api/complaints', complaintRoutes);

app.use((err, req, res, next) => {
  logger.error('未捕获的错误', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, async () => {
  logger.info(`服务启动，监听端口 ${PORT}`);
  logger.info('正在初始化样例数据...');
  
  try {
    const samples = await initializeSampleData();
    logger.info('样例数据初始化完成');
    logger.info(` - 总订单数: ${samples.orderCount}`);
    logger.info(` - 总投诉数: ${samples.complaintCount}`);
    logger.info('');
    logger.info('API 端点:');
    logger.info('  GET  /health                                - 健康检查');
    logger.info('  POST /api/orders                            - 创建订单');
    logger.info('  GET  /api/orders/:id                        - 查询订单');
    logger.info('  GET  /api/orders/:id/weight-chain           - 订单重量链路');
    logger.info('  POST /api/orders/:id/confirm-delivery       - 确认配送');
    logger.info('  POST /api/orders/:id/weight-confirmation    - 添加称重确认');
    logger.info('  POST /api/orders/:id/leader-confirm         - 团长确认');
    logger.info('');
    logger.info('  POST /api/complaints                        - 创建投诉');
    logger.info('  GET  /api/complaints/:id                    - 查询投诉详情');
    logger.info('  GET  /api/complaints                        - 查询投诉列表');
    logger.info('  POST /api/complaints/:id/evidence           - 添加证据');
    logger.info('  POST /api/complaints/:id/submit-leader-confirm - 提交团长确认');
    logger.info('  POST /api/complaints/:id/leader-confirm     - 团长确认操作');
    logger.info('  POST /api/complaints/:id/trial-calculate    - 赔付试算');
    logger.info('  POST /api/complaints/:id/approve            - 审批');
    logger.info('  POST /api/complaints/:id/process-payment    - 发起打款');
    logger.info('  POST /api/complaints/:id/payment-callback   - 处理支付回调');
    logger.info('  POST /api/complaints/:id/manual-correct     - 人工修正');
    logger.info('  POST /api/complaints/:id/retry-exception    - 重试异常');
    logger.info('  GET  /api/complaints/stats/summary          - 统计汇总');
    logger.info('  GET  /api/complaints/report/export          - 导出报告');
    logger.info('');
    logger.info('内置样例场景 (通过 /api/complaints/:id 查询):');
    Object.entries(samples.complaints).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value.complaintNo}`);
    });
    logger.info('');
    logger.info('运行 `npm run demo` 查看详细演示流程');
  } catch (error) {
    logger.error('样例数据初始化失败', error);
  }
});
