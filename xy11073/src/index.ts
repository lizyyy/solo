import express from 'express';
import importRoutes from './routes/import.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/import', importRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '运动康复门店康复器械预约API运行正常' });
});

app.listen(PORT, () => {
  console.log(`
========================================
  运动康复门店康复器械预约API
  服务已启动，端口: ${PORT}
========================================
  API端点:
  POST /api/import/upload    - 上传文件导入 (CSV/JSON)
  POST /api/import/json      - JSON数据导入
  POST /api/import/review    - 人工审核异常记录
  GET  /api/import/result/:batchId - 查询导入结果
  GET  /api/import/export/:batchId/json - 导出JSON
  GET  /api/import/export/:batchId/report - 导出可读报告
  GET  /api/import/export/:batchId/csv - 导出CSV
  GET  /api/import/results   - 查询所有导入结果
  GET  /health               - 健康检查
========================================
  `);
});

export default app;
