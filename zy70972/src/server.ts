import express, { Request, Response } from 'express';
import activityRoutes from './routes/activity.routes';
import batchRoutes from './routes/batch.routes';
import queryRoutes from './routes/query.routes';
import exportRoutes from './routes/export.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/activities', activityRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: '街道活动报名处理服务',
    version: '1.0.0',
    endpoints: {
      activities: '/api/activities',
      batches: '/api/batches',
      query: '/api/query',
      export: '/api/export',
      health: '/api/health',
    },
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET  /api/activities - 获取活动列表`);
  console.log(`  POST /api/activities - 创建活动`);
  console.log(`  POST /api/batches/upload - 上传批次文件`);
  console.log(`  POST /api/batches/:id/process - 处理批次`);
  console.log(`  GET  /api/query/registrations - 查询报名记录`);
  console.log(`  GET  /api/query/waitlist - 查询候补记录`);
  console.log(`  GET  /api/query/attendance - 查询签到记录`);
  console.log(`  GET  /api/export/registrations - 导出报名记录`);
});
