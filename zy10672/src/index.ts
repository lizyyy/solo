import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import commandRoutes from './routes/commands';
import hostGroupRoutes from './routes/hostGroups';
import auditRoutes from './routes/audit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/commands', commandRoutes);
app.use('/api/host-groups', hostGroupRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 远程运维平台批量命令审批 API 服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`✅ 健康检查: http://localhost:${PORT}/health`);
});

export default app;
