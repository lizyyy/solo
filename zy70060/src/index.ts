import express from 'express';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';

import { customerRouter } from './routes/customer-routes';
import { quotaRouter } from './routes/quota-routes';
import { transactionRouter } from './routes/transaction-routes';
import { reversalRouter } from './routes/reversal-routes';
import { rateRouter } from './routes/rate-routes';
import { reportingRouter } from './routes/reporting-routes';
import { operationsRouter } from './routes/operations-routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '外汇结售汇额度 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/customers', customerRouter);
app.use('/api/quota', quotaRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/reversals', reversalRouter);
app.use('/api/rates', rateRouter);
app.use('/api/reports', reportingRouter);
app.use('/api/operations', operationsRouter);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message 
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('健康检查: GET /health');
      console.log('');
      console.log('API 端点:');
      console.log('  客户管理:   POST /api/customers, GET /api/customers');
      console.log('  额度管理:   GET /api/quota/:customerId, POST /api/quota/:customerId/recalculate');
      console.log('  交易管理:   POST /api/transactions, GET /api/transactions/:id');
      console.log('  冲正管理:   POST /api/reversals, POST /api/reversals/retry-all');
      console.log('  汇率管理:   GET /api/rates/latest/:currency, POST /api/rates');
      console.log('  监管报表:   POST /api/reports/daily, GET /api/reports/export/:date');
      console.log('  失败操作:   GET /api/operations, GET /api/operations/pending');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();