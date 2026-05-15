import express from 'express';
import handoverRoutes from './routes/handoverRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/handover', handoverRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '租户开通台服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`🚀 租户开通台服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`📁 API文档:`);
  console.log(`   - POST   /api/handover              - 创建交接单`);
  console.log(`   - GET    /api/handover              - 获取交接单列表`);
  console.log(`   - GET    /api/handover/:id          - 获取交接单详情`);
  console.log(`   - POST   /api/handover/:id/process  - 处理交接单`);
  console.log(`   - POST   /api/handover/:id/manual-fix - 人工修正`);
  console.log(`   - POST   /api/handover/:id/material-summary - 添加材料摘要`);
  console.log(`   - GET    /api/handover/history/all  - 获取所有历史记录`);
  console.log(`   - GET    /api/handover/history/query?resourceRange=xxx - 按资源范围查询历史`);
});

export default app;
