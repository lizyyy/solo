import express from 'express';
import projectRoutes from './routes/projects';
import milestoneRoutes from './routes/milestones';
import extensionRoutes from './routes/extensions';
import exportRoutes from './routes/export';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  GET  /api/health               - 健康检查');
  console.log('  GET  /api/projects             - 项目列表');
  console.log('  GET  /api/projects/:id         - 项目详情');
  console.log('  POST /api/projects             - 创建项目');
  console.log('  GET  /api/milestones           - 里程碑列表');
  console.log('  GET  /api/milestones/:id       - 里程碑详情(含子任务和历史)');
  console.log('  POST /api/milestones           - 创建里程碑');
  console.log('  GET  /api/extensions           - 延期申请列表');
  console.log('  GET  /api/extensions/:id       - 延期申请详情');
  console.log('  POST /api/extensions           - 提交延期申请');
  console.log('  POST /api/extensions/:id/review - 审核延期申请');
  console.log('  GET  /api/export/milestones    - 导出里程碑CSV');
  console.log('  GET  /api/export/extensions    - 导出延期申请CSV');
  console.log('  GET  /api/export/history       - 导出历史记录CSV');
});
