import express from 'express';
import taskRoutes from './routes/taskRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '任务调度平台失败任务熔断恢复 API' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档:`);
  console.log(`  POST   /api/tasks              - 创建任务`);
  console.log(`  GET    /api/tasks              - 任务列表`);
  console.log(`  GET    /api/tasks/:id          - 任务详情`);
  console.log(`  PUT    /api/tasks/:id          - 更新任务`);
  console.log(`  POST   /api/tasks/:id/failure  - 记录失败`);
  console.log(`  POST   /api/tasks/:id/apply-recovery  - 申请恢复`);
  console.log(`  POST   /api/tasks/:id/audit-recovery  - 审核恢复`);
  console.log(`  POST   /api/tasks/:id/withdraw - 撤回申请`);
  console.log(`  POST   /api/tasks/:id/manual-remark - 人工备注（处理队列重试）`);
  console.log(`  PUT    /api/tasks/:taskId/conditions/:conditionId/meet - 标记恢复条件已满足`);
  console.log(`  GET    /api/tasks/export/csv   - 导出CSV`);
  console.log(`  POST   /api/tasks/import       - 导入任务`);
});

export default app;
