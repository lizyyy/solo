import express from 'express';
import { requestTracker, errorHandler } from './middleware/requestTracker';
import batchesRouter from './api/batches';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestTracker);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'used-car-prep-playback-service',
      timestamp: Date.now()
    },
    traceId: req.traceId,
    timestamp: Date.now()
  });
});

app.use('/api/batches', batchesRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
========================================
二手车整备验收回放链路服务已启动
端口: ${PORT}
健康检查: http://localhost:${PORT}/health
API文档:
  POST /api/batches/submit        - 提交批次
  GET  /api/batches               - 查询批次列表
  GET  /api/batches/:id           - 查询批次详情
  POST /api/batches/:id/recall    - 撤回批次
  POST /api/batches/:id/freeze    - 冻结批次
  POST /api/batches/:id/unfreeze  - 解冻批次
  POST /api/batches/:id/export    - 导出批次
========================================
  `);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});
