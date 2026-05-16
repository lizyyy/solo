import express from 'express';
import { initDatabase } from './database';
import ticketScanRoutes from './routes/ticketScan.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/ticket-scan', ticketScanRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ticket-attachment-scan-api'
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`
============================================
工单附件病毒扫描API 已启动
端口: ${PORT}
健康检查: http://localhost:${PORT}/health
API 路径: http://localhost:${PORT}/api/ticket-scan
============================================
      `);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
}

startServer();
