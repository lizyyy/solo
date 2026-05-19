import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import inspectionRoutes from './routes/inspection.routes';
import repairRoutes from './routes/repair.routes';
import pumpRoomRoutes from './routes/pump-room.routes';
import personRoutes from './routes/person.routes';
import auditRoutes from './routes/audit.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/inspections', inspectionRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/pump-rooms', pumpRoomRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/audit', auditRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`泵房巡检管理系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

export default app;
