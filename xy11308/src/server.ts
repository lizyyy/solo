import 'reflect-metadata';
import express from 'express';
import { AppDataSource } from './database/data-source';
import apiRoutes from './routes/api';
import { auditMiddleware } from './middleware/audit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(auditMiddleware);
app.use('/api', apiRoutes);

AppDataSource.initialize()
  .then(() => {
    console.log('数据库连接成功');
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('健康检查: http://localhost:3000/health');
      console.log('API 文档:');
      console.log('  - GET  /api/elders - 获取老人列表');
      console.log('  - POST /api/elders - 创建老人');
      console.log('  - GET  /api/meals - 获取餐食列表');
      console.log('  - POST /api/meals - 创建餐食');
      console.log('  - GET  /api/assignments/check-conflict - 检查配餐冲突');
      console.log('  - POST /api/assignments - 创建配餐');
      console.log('  - GET  /api/assignments - 获取配餐列表');
      console.log('  - POST /api/meal-changes - 改餐');
      console.log('  - POST /api/deliveries - 更新配送');
      console.log('  - POST /api/follow-ups - 创建回访');
      console.log('  - POST /api/batch/assign-meals - 批量配餐');
      console.log('  - POST /api/report/summary - 获取报告汇总');
      console.log('  - POST /api/report/export - 导出Excel报告');
      console.log('  - GET  /api/audit-logs - 获取审计日志');
      console.log('');
      console.log('请求头要求:');
      console.log('  - x-operator: 操作人姓名');
      console.log('  - x-operator-role: 操作人角色 (admin/staff/manager)');
    });
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
    process.exit(1);
  });