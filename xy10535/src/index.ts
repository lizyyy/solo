import express from 'express';
import cors from 'cors';
import ticketsRouter from './routes/tickets';
import transfersRouter from './routes/transfers';
import refundsRouter from './routes/refunds';
import validationsRouter from './routes/validations';
import reportsRouter from './routes/reports';
import { sendSuccess } from './middleware/response';

const app = express();
const PORT = process.env.PORT || 8765;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: Date.now(),
    service: '场馆票务核销 API'
  });
});

app.use('/api/tickets', ticketsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/validations', validationsRouter);
app.use('/api/reports', reportsRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误'
    },
    requestId: Math.random().toString(36),
    timestamp: Date.now()
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  场馆票务核销 API`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  console.log(`API 接口:`);
  console.log(`  POST   /api/tickets              - 创建票券`);
  console.log(`  POST   /api/tickets/package      - 创建套票`);
  console.log(`  GET    /api/tickets              - 查询票券列表`);
  console.log(`  GET    /api/tickets/:id          - 查询票券详情`);
  console.log(`  GET    /api/tickets/:id/detail   - 票券完整报告`);
  console.log(`  POST   /api/tickets/:id/correct  - 人工修正`);
  console.log(``);
  console.log(`  POST   /api/transfers            - 发起转赠`);
  console.log(`  POST   /api/transfers/:id/complete - 完成转赠`);
  console.log(``);
  console.log(`  POST   /api/refunds              - 申请退票`);
  console.log(`  POST   /api/refunds/:id/approve  - 审批退票`);
  console.log(``);
  console.log(`  POST   /api/validations/validate - 在线核销`);
  console.log(`  POST   /api/validations/offline-package - 创建离线包`);
  console.log(`  POST   /api/validations/offline-package/upload - 上传离线包`);
  console.log(`  GET    /api/validations/stats/event/:eventId - 活动统计`);
  console.log(``);
  console.log(`  GET    /api/reports/ticket/:id/csv    - 导出票券报告CSV`);
  console.log(`  GET    /api/reports/event/:id/csv     - 导出活动报告CSV`);
  console.log(`  GET    /api/reports/validations       - 导出全部核销CSV`);
  console.log(`  GET    /api/reports/audit             - 审计日志`);
  console.log(``);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});

export default app;
