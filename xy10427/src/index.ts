import express from 'express';
import importRoutes from './routes/importRoutes';
import calculationRoutes from './routes/calculationRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'meal-subsidy-api' });
});

app.use('/api/import', importRoutes);
app.use('/api', calculationRoutes);

app.listen(PORT, () => {
  console.log(`员工餐补异常 API 已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('可用接口:');
  console.log('  POST /api/import/employees      - 导入员工');
  console.log('  POST /api/import/shifts         - 导入班次');
  console.log('  POST /api/import/consumptions   - 导入消费流水（幂等）');
  console.log('  POST /api/import/subsidy-rules  - 导入补贴规则');
  console.log('  POST /api/calculate             - 执行餐补计算');
  console.log('  POST /api/approval              - 人工复核');
  console.log('  GET  /api/batches               - 查询计算批次列表');
  console.log('  GET  /api/summary/:batchId      - 按部门查询汇总');
  console.log('  GET  /api/differences/:batchId  - 查询复核前后差额');
  console.log('  GET  /api/abnormals/:batchId    - 查询异常明细');
  console.log('  GET  /api/payout-report/:batchId - 查询发放报表');
  console.log('  POST /api/regenerate-report/:batchId - 重新生成发放报表');
});
