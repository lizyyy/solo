import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeDB } from './database/init';
import batchRoutes from './routes/batches';
import financeRoutes from './routes/finance';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/batches', batchRoutes);
app.use('/api/finance', financeRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'equipment-return-state-machine'
    }
  });
});

app.get('/api/exports/:filename', (req, res) => {
  const exportDir = path.join(__dirname, '../exports');
  const filePath = path.join(exportDir, req.params.filename);
  
  if (fs.existsSync(filePath) && filePath.endsWith('.csv')) {
    res.download(filePath);
  } else {
    res.status(404).json({ success: false, error: '文件不存在' });
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

async function startServer() {
  try {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    await initializeDB();
    console.log('Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   设备租赁归还异常回执状态机 API 服务已启动                ║
║                                                           ║
║   服务地址: http://localhost:${PORT}                        ║
║   健康检查: http://localhost:${PORT}/api/health             ║
║                                                           ║
║   API 端点:                                               ║
║     POST   /api/batches              - 创建批次            ║
║     GET    /api/batches              - 批次列表            ║
║     GET    /api/batches/:id          - 批次详情            ║
║     POST   /api/batches/:id/transition - 状态转换          ║
║     POST   /api/batches/:id/attachments - 上传附件         ║
║     GET    /api/batches/:id/history  - 操作历史            ║
║     POST   /api/batches/export       - 导出批次列表        ║
║                                                           ║
║     GET    /api/finance/summary      - 财务汇总            ║
║     GET    /api/finance/failed-records - 失败记录          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
