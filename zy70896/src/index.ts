import express from 'express';
import batchesRouter from './routes/batches';
import recordsRouter from './routes/records';
import referenceRouter from './routes/reference';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/batches', batchesRouter);
app.use('/api/records', recordsRouter);
app.use('/api/reference', referenceRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: '网点运营交接记录服务运行中' });
});

app.listen(PORT, () => {
  console.log(`服务运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  GET  /api/health             - 健康检查');
  console.log('  POST /api/batches            - 创建批次');
  console.log('  POST /api/batches/:id/upload - 上传CSV交接记录');
  console.log('  GET  /api/batches            - 获取批次列表');
  console.log('  GET  /api/records            - 查询记录（支持筛选）');
  console.log('  GET  /api/records/:id        - 获取单条记录详情');
  console.log('  POST /api/records/:id/process - 标记处理');
  console.log('  POST /api/records/:id/return  - 退回修改');
  console.log('  POST /api/records/:id/approve - 审批通过');
  console.log('  GET  /api/records/export/download - 导出记录CSV');
  console.log('  GET  /api/reference/tellers  - 获取柜员列表');
  console.log('  POST /api/reference/tellers  - 保存柜员信息');
  console.log('  GET  /api/reference/schedules - 获取排班列表');
  console.log('  POST /api/reference/schedules - 保存排班信息');
});

export default app;
