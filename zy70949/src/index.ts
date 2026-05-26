import express = require('express');
import reconciliationRoutes from './routes/reconciliation.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    service: '体检中心财务对账 API',
    version: '1.0.0',
    message: '服务已启动，请使用 /api/reconciliation/health 检查健康状态',
  });
});

app.use('/api/reconciliation', reconciliationRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('未捕获的错误:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
  });
});

app.listen(PORT, () => {
  console.log(`体检中心财务对账 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/reconciliation/health`);
  console.log(`规则列表: http://localhost:${PORT}/api/reconciliation/rules`);
  console.log('');
  console.log('使用方式:');
  console.log('  1. 文件上传: POST /api/reconciliation/upload');
  console.log('  2. JSON数据: POST /api/reconciliation/process');
});

export default app;
