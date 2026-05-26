import express from 'express';
import { initDatabase } from './database';
import batchesRouter from './routes/batches';
import processingRouter from './routes/processing';
import certificatesRouter from './routes/certificates';
import queryRouter from './routes/query';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/batches', batchesRouter);
app.use('/api/processing', processingRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/query', queryRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`培训运营服务已启动: http://localhost:${PORT}`);
      console.log('健康检查: GET /api/health');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

start();
