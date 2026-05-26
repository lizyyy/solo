import express from 'express';
import { initDatabase } from './database';
import materialsRouter from './routes/materials';
import certificatesRouter from './routes/certificates';
import traceRouter from './routes/trace';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/v1/materials', materialsRouter);
app.use('/api/v1/certificates', certificatesRouter);
app.use('/api/v1/trace', traceRouter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 端点:');
      console.log('  POST /api/v1/materials/submit - 提交培训材料');
      console.log('  GET  /api/v1/materials/:batchId - 查询批次处理结果');
      console.log('  GET  /api/v1/certificates/:certificateId - 查询证书');
      console.log('  GET  /api/v1/certificates/batch/:batchId - 查询批次证书');
      console.log('  GET  /api/v1/trace/batch/:batchId - 溯源查询');
      console.log('  GET  /health - 健康检查');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
