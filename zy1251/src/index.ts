import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import permissionRoutes from './routes/permissions';
import resourceRoutes from './routes/resources';
import permissionCheckRoutes from './routes/permissionCheck';
import auditLogRoutes from './routes/auditLogs';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/permission-check', permissionCheckRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 Auth API 服务已启动`);
  console.log(`📍 监听端口: ${config.port}`);
  console.log(`🔗 API 基础路径: http://localhost:${config.port}/api`);
  console.log(`💊 健康检查: http://localhost:${config.port}/health`);
});

export { app, server };
