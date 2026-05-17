import express from 'express';
import stockLockRoutes from './routes/stockLock';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '库存锁定释放API服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/stock', stockLockRoutes);

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('库存锁定释放API服务已启动');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health');
  console.log('');
  console.log('API 端点列表:');
  console.log('  POST   /api/stock/locks              - 创建库存锁定');
  console.log('  GET    /api/stock/locks              - 查询库存锁定列表');
  console.log('  GET    /api/stock/locks/export       - 导库存锁定列表');
  console.log('  POST   /api/stock/locks/advance      - 推进状态（释放库存）');
  console.log('  POST   /api/stock/locks/correct      - 人工修正');
  console.log('  GET    /api/stock/exceptions        - 查询异常列表');
  console.log('  GET    /api/stock/exceptions/export  - 导出异常清单');
  console.log('  POST   /api/stock/exceptions/resolve  - 标记异常已解决');
  console.log('  POST   /api/stock/reports/:activityId  - 生成释放报告');
  console.log('  GET    /api/stock/reports            - 查询报告列表');
  console.log('  GET    /api/stock/reports/:activityId/export - 导出报告');
  console.log('='.repeat(60));
});

export default app;
