import express from 'express';
import cors from 'cors';
import importRoutes from './routes/importRoutes';
import reconciliationRoutes from './routes/reconciliationRoutes';
import reviewRoutes from './routes/reviewRoutes';
import reportRoutes from './routes/reportRoutes';
import traceabilityRoutes from './routes/traceabilityRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/import', importRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/traceability', traceabilityRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '景区缆车检修放行对账服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API 路由不存在',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 景区缆车检修放行对账服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📋 API 路由:');
  console.log('  数据导入: POST /api/import/*');
  console.log('  对账处理: POST /api/reconciliation/:batchId');
  console.log('  人工复核: POST /api/review/:resultId/diff/:diffId');
  console.log('  报告生成: POST /api/report');
  console.log('  追溯查询: GET /api/traceability/*');
});

export default app;
