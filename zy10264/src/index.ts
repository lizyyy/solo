import express from 'express';
import masterRoutes from './routes/master';
import applicationRoutes from './routes/application';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', masterRoutes);
app.use('/api/applications', applicationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`签证材料 API 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点:');
  console.log('  GET  /health               - 健康检查');
  console.log('');
  console.log('  基础数据:');
  console.log('  POST /api/countries        - 创建国家');
  console.log('  GET  /api/countries        - 获取国家列表');
  console.log('  POST /api/material-types   - 创建材料类型');
  console.log('  GET  /api/material-types   - 获取材料类型列表');
  console.log('  POST /api/tourists         - 创建游客');
  console.log('  GET  /api/tourists         - 获取游客列表');
  console.log('');
  console.log('  申请管理:');
  console.log('  POST /api/applications     - 创建签证申请');
  console.log('  GET  /api/applications     - 获取申请列表');
  console.log('  GET  /api/applications/:id - 获取申请详情');
  console.log('  POST /api/applications/:id/submit      - 提交申请');
  console.log('  POST /api/applications/:id/start-review - 开始审核');
  console.log('  POST /api/applications/:id/send        - 送签');
  console.log('  POST /api/applications/:id/return      - 退回');
  console.log('  POST /api/applications/:id/supplement  - 要求补件');
  console.log('  POST /api/applications/:id/close       - 关闭申请');
  console.log('');
  console.log('  材料管理:');
  console.log('  GET  /api/applications/:id/materials   - 获取申请材料');
  console.log('  GET  /api/applications/:id/missing-materials - 查询缺失材料');
  console.log('  POST /api/applications/:id/materials   - 上传材料');
  console.log('  POST /api/applications/materials/:id/review - 审核材料');
  console.log('  GET  /api/applications/:id/history     - 状态变更历史');
});

export default app;
