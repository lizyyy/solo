import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`检验科危急值对账服务已启动: http://localhost:${PORT}`);
  console.log('API 文档:');
  console.log('  GET  /api/health              - 健康检查');
  console.log('  POST /api/import/critical-values  - 导入危急值CSV');
  console.log('  POST /api/import/callbacks    - 导入电话回告JSON');
  console.log('  POST /api/import/duty-schedules - 导入值班表CSV');
  console.log('  POST /api/reconciliation/run  - 执行对账');
  console.log('  GET  /api/reconciliation      - 获取对账结果列表');
  console.log('  GET  /api/reconciliation/:id  - 获取对账详情');
  console.log('  POST /api/reconciliation/:id/confirm - 确认复核');
  console.log('  POST /api/reconciliation/:id/modify  - 修改回告记录');
  console.log('  POST /api/reconciliation/:id/dismiss - 忽略差异');
  console.log('  GET  /api/reconciliation/:id/history - 获取复核历史');
  console.log('  GET  /api/report/summary      - 获取汇总报告');
  console.log('  GET  /api/report/export/reconciliation - 导出对账报告CSV');
  console.log('  GET  /api/report/export/discrepancy   - 导出差异报告CSV');
  console.log('  DELETE /api/data/clear        - 清空所有数据');
});

export default app;
