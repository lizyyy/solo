import express from 'express';
import cors from 'cors';
import samplesRouter from './routes/samples';
import exceptionsRouter from './routes/exceptions';
import batchesRouter from './routes/batches';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/samples', samplesRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/batches', batchesRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '样本交接链 API 运行正常', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`样本交接链 API 服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
