import express from 'express';
import cors from 'cors';
import batchesRouter from './routes/batches';
import masterDataRouter from './routes/masterData';
import { seedDatabase } from './scripts/seed';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/batches', batchesRouter);
app.use('/api/master', masterDataRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '咖啡豆烘焙批次管理 API 运行正常',
    timestamp: new Date()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用咖啡豆烘焙批次管理 API',
    endpoints: {
      health: 'GET /api/health',
      batches: {
        list: 'GET /api/batches',
        reports: 'GET /api/batches/reports',
        byStatus: 'GET /api/batches/status/:status',
        detail: 'GET /api/batches/:id',
        create: 'POST /api/batches',
        update: 'PATCH /api/batches/:id',
        resolve: 'POST /api/batches/:id/resolve'
      },
      masterData: {
        greenCoffees: 'GET /api/master/green-coffees',
        roastingCurves: 'GET /api/master/roasting-curves'
      }
    },
    timestamp: new Date()
  });
});

seedDatabase();

app.listen(PORT, () => {
  console.log(`\n🚀 咖啡豆烘焙批次管理 API 服务器已启动`);
  console.log(`📍 服务器地址: http://localhost:${PORT}`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api`);
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health\n`);
  console.log(`✨ 已预置示例数据，包括：`);
  console.log(`   - 3 批生豆数据`);
  console.log(`   - 3 条烘焙曲线`);
  console.log(`   - 6 个烘焙批次（含异常样例）`);
  console.log(`\n🔍 测试接口示例：`);
  console.log(`   - 获取所有批次: curl http://localhost:${PORT}/api/batches`);
  console.log(`   - 获取报表统计: curl http://localhost:${PORT}/api/batches/reports`);
  console.log(`   - 获取待处理批次: curl http://localhost:${PORT}/api/batches/status/needs_attention`);
  console.log(`   - 获取已驳回批次: curl http://localhost:${PORT}/api/batches/status/rejected`);
  console.log(`\n`);
});
