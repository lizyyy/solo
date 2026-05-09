import express from 'express';
import { initDb } from './db';

import listVersionsRouter from './routes/listVersions';
import hitsRouter from './routes/hits';
import freezesRouter from './routes/freezes';
import accountsRouter from './routes/accounts';
import auditRouter from './routes/audit';
import dashboardRouter from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/list-versions', listVersionsRouter);
app.use('/api/hits', hitsRouter);
app.use('/api/freezes', freezesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: '反洗钱名单命中复核 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      listVersions: {
        create: 'POST /api/list-versions',
        list: 'GET /api/list-versions',
        get: 'GET /api/list-versions/:id',
        archive: 'POST /api/list-versions/:id/archive'
      },
      hits: {
        create: 'POST /api/hits',
        list: 'GET /api/hits',
        detail: 'GET /api/hits/:id',
        review: 'POST /api/hits/:id/review',
        close: 'POST /api/hits/:id/close'
      },
      freezes: {
        list: 'GET /api/freezes',
        detail: 'GET /api/freezes/:id',
        requestUnfreeze: 'POST /api/freezes/:id/request-unfreeze',
        approveUnfreeze: 'POST /api/freezes/:id/approve-unfreeze',
        rejectUnfreeze: 'POST /api/freezes/:id/reject-unfreeze'
      },
      accounts: {
        summary: 'GET /api/accounts/:accountId/summary',
        report: 'GET /api/accounts/:accountId/report'
      },
      audit: {
        query: 'GET /api/audit',
        exportCSV: 'GET /api/audit/export/csv',
        exportJSON: 'GET /api/audit/export/json',
        hitReport: 'GET /api/audit/hit/:hitId/report'
      },
      dashboard: 'GET /api/dashboard'
    }
  });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`反洗钱名单命中复核 API 服务运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 文档: http://localhost:${PORT}/`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
