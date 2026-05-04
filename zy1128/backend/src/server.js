import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import initDatabase from './scripts/init-db.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  initDatabase();
  console.log('数据库初始化完成');
} catch (e) {
  console.error('数据库初始化失败:', e.message);
}

app.get('/api', (req, res) => {
  res.json({
    name: '理财收益到账核对台 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      products: 'GET /api/products',
      accounts: 'GET /api/accounts',
      holders: 'GET /api/holders',
      subscriptions: 'GET /api/subscriptions',
      expectedPayouts: 'GET /api/expected-payouts',
      transactions: 'GET /api/transactions',
      reconciliations: 'GET /api/reconciliations',
      allocations: 'GET /api/allocations',
      import: {
        products: 'POST /api/import/products',
        transactions: 'POST /api/import/transactions',
        subscriptions: 'POST /api/import/subscriptions',
        payoutRules: 'POST /api/import/payout-rules'
      },
      calculate: {
        expectedPayouts: 'POST /api/calculate/expected-payouts',
        payoutDetails: 'GET /api/calculate/payout-details/:id'
      },
      matching: {
        auto: 'POST /api/matching/auto',
        manual: 'POST /api/matching/manual',
        unmatch: 'POST /api/matching/unmatch/:id',
        adjustment: 'POST /api/matching/adjustment/:id',
        stats: 'GET /api/matching/stats'
      },
      export: {
        reconciliations: 'GET /api/export/reconciliations?format=csv|html|markdown',
        holder: 'GET /api/export/holder/:id?format=csv|html|markdown'
      },
      stats: 'GET /api/stats'
    }
  });
});

app.use('/api', apiRoutes);

const staticDir = path.join(__dirname, '../../../frontend/dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 理财收益到账核对台后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📡 API 地址: http://localhost:${PORT}/api`);
  console.log(`💡 健康检查: http://localhost:${PORT}/api/health`);
});

export default app;
