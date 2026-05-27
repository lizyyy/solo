import express from 'express';
import bodyParser from 'body-parser';
import { initDatabase } from './database';
import { createBatchRouter } from './routes/batchRoutes';
import { createMaterialRouter } from './routes/materialRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  const db = await initDatabase();
  console.log('数据库初始化完成');

  app.use('/api/batches', createBatchRouter(db));
  app.use('/api/materials', createMaterialRouter(db));

  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('未处理的错误:', error);
    res.status(500).json({ error: '服务器内部错误', message: error.message });
  });

  app.listen(PORT, () => {
    console.log(`二手设备租赁押金 API 服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log('');
    console.log('可用API端点:');
    console.log('  POST /api/batches              - 创建批次');
    console.log('  GET  /api/batches              - 获取批次列表');
    console.log('  GET  /api/batches/:id          - 获取批次详情');
    console.log('');
    console.log('  POST /api/materials            - 登记材料');
    console.log('  GET  /api/materials/batch/:id  - 获取批次材料');
    console.log('  GET  /api/materials/:id        - 获取材料详情');
    console.log('  GET  /api/materials/:id/trail  - 获取材料处理轨迹');
    console.log('  POST /api/materials/:id/reclassify  - 修改材料分类');
    console.log('  POST /api/materials/:id/recalculate - 重算单条材料');
    console.log('  POST /api/materials/batch/:id/recalculate - 重算批次');
    console.log('');
    console.log('  GET  /api/materials/export/csv  - CSV导出');
    console.log('  GET  /api/materials/export/json - JSON导出');
    console.log('  GET  /api/materials/check/duplicate - 检查重复扣款');
    console.log('');
    console.log('  GET  /api/materials/equipment/:serial/tracking - 设备追踪');
    console.log('  GET  /api/materials/equipment/:serial/history  - 设备历史');
    console.log('  GET  /api/materials/order/:orderNo/tracking    - 订单追踪');
    console.log('  GET  /api/materials/audit/logs                 - 审计日志');
  });
}

startServer().catch(console.error);
