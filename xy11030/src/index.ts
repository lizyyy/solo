import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDatabase } from './database';
import reissueRoutes from './routes/reissueRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/reissues', reissueRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    message: '社区团购仓团购缺件补发系统 API',
    version: '1.0.0',
    endpoints: {
      list: 'GET /api/reissues',
      create: 'POST /api/reissues',
      detail: 'GET /api/reissues/:id',
      history: 'GET /api/reissues/:id/history',
      updateStatus: 'PUT /api/reissues/:id/status',
      resubmit: 'POST /api/reissues/:id/resubmit',
      statistics: 'GET /api/reissues/statistics',
      importExcel: 'POST /api/reissues/import/excel',
      importCsv: 'POST /api/reissues/import/csv',
      template: 'GET /api/reissues/import/template'
    }
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();

export default app;
