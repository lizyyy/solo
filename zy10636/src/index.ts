import express from 'express';
import cors from 'cors';
import inspectionRoutes from './routes/inspection';
import deviceRoutes from './routes/device';
import inspectorRoutes from './routes/inspector';
import './database';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/inspection', inspectionRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/inspectors', inspectorRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '设备维保系统巡检漏检补录 API 运行正常' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 服务器启动成功`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`\n📋 API 端点:`);
  console.log(`  POST /api/inspection/records          - 创建漏检记录`);
  console.log(`  GET  /api/inspection/records          - 获取记录列表`);
  console.log(`  GET  /api/inspection/records/:id      - 获取记录详情`);
  console.log(`  GET  /api/inspection/records/:id/history - 获取操作历史`);
  console.log(`  POST /api/inspection/records/:id/submit  - 提交补录`);
  console.log(`  POST /api/inspection/records/:id/confirm - 确认补录`);
  console.log(`  POST /api/inspection/records/:id/reject  - 驳回补录`);
  console.log(`  POST /api/inspection/records/:id/approve-review - 人工复核通过`);
  console.log(`  GET  /api/inspection/export/records      - 导出记录列表`);
  console.log(`  GET  /api/inspection/export/records/:id  - 导出单条记录`);
  console.log(`  POST /api/inspection/import/records      - 批量导入记录`);
  console.log(`\n`);
});

export default app;
