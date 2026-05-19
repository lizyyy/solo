import express from 'express';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`会展物资管理系统已启动，端口: ${PORT}`);
  console.log('API 文档:');
  console.log('  POST /api/materials/import - 导入物资');
  console.log('  POST /api/materials/occupy - 借用物资');
  console.log('  POST /api/materials/transfer - 调拨物资');
  console.log('  POST /api/materials/return - 归还物资');
  console.log('  POST /api/materials/damage - 报损物资');
  console.log('  POST /api/materials/rollback - 回滚操作');
  console.log('  GET /api/materials - 查询物资列表');
  console.log('  GET /api/booths - 查询展位列表');
  console.log('  GET /api/records - 查询借用记录');
  console.log('  GET /api/audit-logs - 查询审计日志');
  console.log('  GET /api/export - 导出报表');
  console.log('');
  console.log('幂等性: 使用 x-request-id 头，重复请求返回相同结果');
  console.log('审计: 所有操作都会记录操作人、角色、时间和结果');
  console.log('敏感字段: 导出和日志中敏感字段会自动脱敏');
});
