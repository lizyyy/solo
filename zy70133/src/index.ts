import express, { Request, Response, NextFunction } from 'express';
import budgetPoolRoutes from './routes/budgetPoolRoutes';
import campaignRoutes from './routes/campaignRoutes';
import resourceRoutes from './routes/resourceRoutes';
import bindingRoutes from './routes/bindingRoutes';
import transactionRoutes from './routes/transactionRoutes';
import reportRoutes from './routes/reportRoutes';
import { AppException } from './exceptions/AppException';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/budget-pools', budgetPoolRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/bindings', bindingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppException) {
    res.status(400).json({
      success: false,
      error: error.toJSON(),
      timestamp: new Date(),
    });
  } else {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
      },
      timestamp: new Date(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         广告预算消耗 API 服务已启动                        ║
╠════════════════════════════════════════════════════════════╣
║  监听端口: ${PORT}                                           ║
║  健康检查: http://localhost:${PORT}/health                    ║
╠════════════════════════════════════════════════════════════╣
║  核心模块:                                                  ║
║  - 预算池管理    POST/GET /api/budget-pools                ║
║  - 广告计划管理  POST/GET /api/campaigns                   ║
║  - 资源管理      POST/GET /api/resources                   ║
║  - 素材绑定      POST/GET /api/bindings                    ║
║  - 交易处理      POST/GET /api/transactions                ║
║  - 报表导出      GET /api/reports                          ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
