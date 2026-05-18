import express from 'express';
import auditRoutes from './routes/auditRoutes';
import { seedSampleData } from './scripts/seedData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/audit', auditRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`户外广告安装队高空作业审批 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档:`);
  console.log(`  POST   /api/audit          - 创建审批申请`);
  console.log(`  GET    /api/audit          - 获取所有审批记录`);
  console.log(`  GET    /api/audit/:id      - 获取单个审批记录`);
  console.log(`  POST   /api/audit/action   - 执行审批动作`);
  console.log(`  GET    /api/audit/status/:status - 按状态查询`);
  console.log(`  GET    /api/audit/:id/consistency - 一致性检查`);
  console.log(`  GET    /api/audit/violations/wind-warning - 大风预警违规记录`);
  console.log('\n正在初始化样例数据...');
  
  seedSampleData();
  
  console.log('样例数据初始化完成！');
  console.log('\n您可以立即开始测试完整的审批流程！');
});
