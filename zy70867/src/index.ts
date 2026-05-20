import express from 'express';
import reconciliationRoutes from './routes/reconciliation';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/reconciliation', reconciliationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '酒店布草洗涤对账API服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`酒店布草洗涤对账API服务已启动，监听端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:`);
  console.log(`  POST /api/reconciliation/submit - 提交对账数据`);
  console.log(`  GET /api/reconciliation/list - 查询对账列表`);
  console.log(`  GET /api/reconciliation/:id - 查询单条对账记录`);
  console.log(`  GET /api/reconciliation/:id/statistics - 查询统计数据`);
  console.log(`  GET /api/reconciliation/:id/export - 导出CSV数据`);
});

export default app;
