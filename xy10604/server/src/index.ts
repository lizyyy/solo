import express from 'express';
import cors from 'cors';
import http from 'http';
import { prisma } from './config/database';
import authRoutes from './routes/auth';
import reagentRoutes from './routes/reagents';
import batchRoutes from './routes/batches';
import openRecordRoutes from './routes/openRecords';
import experimentRoutes from './routes/experiments';
import blockRoutes from './routes/blocks';
import reviewRoutes from './routes/reviews';
import discardRoutes from './routes/discards';
import auditRoutes from './routes/audit';
import exportRoutes from './routes/exports';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/reagents', reagentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/open-records', openRecordRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/discards', discardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/exports', exportRoutes);

app.use(errorHandler);

const server = http.createServer(app);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM 信号接收，正在优雅关闭...');
  server.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

startServer();

export default app;
