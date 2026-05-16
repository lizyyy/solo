import express from 'express';
import filingRoutes from './routes/filing';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/filings', filingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`公网出口备案API服务已启动，端口: ${PORT}`);
  console.log('API文档:');
  console.log('  POST   /api/filings              - 创建备案');
  console.log('  GET    /api/filings              - 查询备案列表');
  console.log('  GET    /api/filings/:id          - 查询单个备案');
  console.log('  POST   /api/filings/:id/advance-status  - 推进状态');
  console.log('  POST   /api/filings/:id/approve  - 审批通过');
  console.log('  POST   /api/filings/:id/reject   - 审批拒绝');
  console.log('  POST   /api/filings/:id/exceptions       - 记录异常');
  console.log('  GET    /api/filings/:id/exceptions       - 查询异常记录');
  console.log('  POST   /api/filings/:id/manual-correction  - 人工修正');
  console.log('  POST   /api/filings/:id/close    - 关闭备案');
  console.log('  GET    /api/filings/:id/report   - 生成报告');
  console.log('  GET    /api/filings/:id/export   - 导出CSV');
  console.log('  POST   /api/filings/check-expired        - 检查到期窗口');
});
