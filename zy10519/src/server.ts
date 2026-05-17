import express from 'express';
import importRoutes from './routes/importRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/api/import', importRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '文件导入断点续传API服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           文件导入断点续传 API 服务启动成功                      ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  健康检查: http://localhost:${PORT}/health                       ║
╠══════════════════════════════════════════════════════════════╣
║                     API 接口列表                                ║
╠══════════════════════════════════════════════════════════════╣
║  POST   /api/import/tasks              - 创建导入任务          ║
║  GET    /api/import/tasks              - 获取任务列表          ║
║  GET    /api/import/tasks/:id          - 获取单个任务          ║
║  GET    /api/import/tasks/:id/chunks   - 获取分片信息          ║
║  POST   /api/import/tasks/:id/upload   - 开始上传              ║
║  POST   /api/import/tasks/:id/process  - 开始处理              ║
║  POST   /api/import/tasks/:id/chunks/:chunkId/process - 处理分片 ║
║  POST   /api/import/tasks/:id/failed   - 标记任务失败          ║
║  POST   /api/import/tasks/:id/needs-fix - 标记需要人工修正     ║
║  POST   /api/import/tasks/:id/resume   - 续传任务              ║
║  GET    /api/import/tasks/:id/resume-summary - 获取续传摘要   ║
║  POST   /api/import/tasks/:id/failures/:rowNumber/fix - 人工修正 ║
║  GET    /api/import/tasks/:id/successes - 获取成功明细         ║
║  GET    /api/import/tasks/:id/failures - 获取失败明细          ║
║  GET    /api/import/tasks/:id/export   - 导出业务数据          ║
║  POST   /api/import/tasks/:id/chunks/:index/retry - 重试分片  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
