import express from 'express';
import tenantInitRoutes from './routes/tenantInitRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tenant-init', tenantInitRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '租户初始化服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST /api/tenant-init/initialize - 初始化租户');
  console.log('  GET  /api/tenant-init/records - 查询初始化记录');
  console.log('  GET  /api/tenant-init/records/:recordId - 查询单条记录');
  console.log('  GET  /api/tenant-init/records/:recordId/details - 查询明细项');
  console.log('  GET  /api/tenant-init/records/:recordId/failed - 查询失败项');
  console.log('  POST /api/tenant-init/rollback/:recordId/candidates - 生成回滚候选');
  console.log('  GET  /api/tenant-init/rollback/:recordId/candidates - 查询回滚候选');
  console.log('  POST /api/tenant-init/rollback/:recordId/execute - 执行回滚');
  console.log('  GET  /api/tenant-init/cleanup/candidates - 生成清理候选');
  console.log('  POST /api/tenant-init/export/:recordId - 导出初始化记录');
  console.log('  POST /api/tenant-init/export/devices/:tenantId - 导出设备台账');
  console.log('  POST /api/tenant-init/revisions - 创建附件修正记录');
  console.log('  GET  /api/tenant-init/revisions/:recordId - 查询附件修正记录');
  console.log('  POST /api/tenant-init/approvals - 创建审批节点');
  console.log('  POST /api/tenant-init/approvals/:nodeId/approve - 审批节点');
  console.log('  GET  /api/tenant-init/approvals/:recordId - 查询审批节点');
  console.log('  GET  /api/tenant-init/devices/:tenantId - 查询设备台账');
});
