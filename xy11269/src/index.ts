import express from 'express';
import bodyParser from 'body-parser';
import * as path from 'path';
import { createRouter } from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', createRouter(DATA_DIR));

app.get('/', (req, res) => {
  res.json({
    name: '客服质检系统',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      import: 'POST /api/import',
      scan: 'POST /api/scan',
      scanRecord: 'POST /api/scan/:id',
      records: 'GET /api/records',
      recordDetail: 'GET /api/records/:id',
      review: 'POST /api/records/:id/review',
      summary: 'GET /api/summary',
      export: 'POST /api/export',
      sensitiveWords: 'GET /api/sensitive-words',
      addSensitiveWord: 'POST /api/sensitive-words',
      stats: 'GET /api/stats'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 客服质检系统已启动`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`💾 数据目录: ${DATA_DIR}`);
  console.log(`========================================\n`);
});

export default app;
