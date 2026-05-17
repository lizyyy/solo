import express from 'express';
import appointmentRoutes from './routes/appointment.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/appointments', appointmentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '内部搜索服务索引重建预约API运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档：');
  console.log('  POST   /api/appointments          - 创建预约');
  console.log('  GET    /api/appointments          - 查询列表');
  console.log('  GET    /api/appointments/:id      - 查询详情');
  console.log('  GET    /api/appointments/:id/histories - 查询历史');
  console.log('  POST   /api/appointments/:id/lock - 锁窗');
  console.log('  POST   /api/appointments/:id/start-rebuild - 开始重建');
  console.log('  POST   /api/appointments/:id/complete - 完成重建');
  console.log('  POST   /api/appointments/:id/reject - 驳回');
  console.log('  POST   /api/appointments/:id/manual-review - 申请人工复核');
  console.log('  POST   /api/appointments/import   - 批量导入');
  console.log('  GET    /api/appointments/export/download - 导出CSV');
});

export default app;
