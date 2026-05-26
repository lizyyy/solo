import express = require('express');
import { Request, Response } from 'express';
import validationRoutes from './routes/validation';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'training-data-validator',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: '培训数据校验API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      processBatch: 'POST /api/validation/process',
      listBatches: 'GET /api/validation/batches',
      getResult: 'GET /api/validation/result/:batchId',
      checkCertificate: 'POST /api/validation/check-certificate'
    }
  });
});

app.use('/api/validation', validationRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  培训数据校验API服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});

export default app;
