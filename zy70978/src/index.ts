import express from 'express';
import importRoutes from './routes/importRoutes';
import reconciliationRoutes from './routes/reconciliationRoutes';
import reviewRoutes from './routes/reviewRoutes';
import reportRoutes from './routes/reportRoutes';
import { dataStore } from './store/dataStore';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/health', (_req, res) => {
  res.json({ status: 'ok', message: '设备租赁对账服务运行中' });
});

app.use('/api/import', importRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/report', reportRoutes);

app.get('/api/data/clear', (_req, res) => {
  dataStore.clearAll();
  res.json({ message: '所有数据已清空' });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`设备租赁对账服务已启动，端口: ${PORT}`);
  console.log('API 端点:');
  console.log('  POST /api/import/rental-orders - 导入租赁订单CSV');
  console.log('  POST /api/import/repair-records - 导入维修记录JSON');
  console.log('  POST /api/import/deposit-rules - 导入押金规则');
  console.log('  POST /api/reconciliation/order/:orderNo - 单个订单对账');
  console.log('  POST /api/reconciliation/all - 全部订单对账');
  console.log('  POST /api/review/approve/:orderNo - 通过订单');
  console.log('  POST /api/review/reject/:orderNo - 退回订单');
  console.log('  POST /api/review/request-more-info/:orderNo - 要求补充材料');
  console.log('  GET /api/report/detailed/:orderNo - 获取详情报告');
  console.log('  GET /api/report/summary - 获取汇总报告');
  console.log('  GET /api/report/export/detailed/:orderNo - 导出详情Excel');
  console.log('  GET /api/report/deduction-evidence/:orderNo - 获取扣款依据');
});

export default app;
