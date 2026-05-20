import express from 'express';
import sequelize from './database';
import batchRoutes from './routes/batches';
import applicationRoutes from './routes/applications';
import certificateRoutes from './routes/certificates';
import scheduleRoutes from './routes/schedules';
import depositRoutes from './routes/deposits';
import exportRoutes from './routes/exports';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/batches', batchRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/exports', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '招商运营后端服务运行正常' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

async function startServer() {
  try {
    await sequelize.sync({ alter: true });
    console.log('数据库同步成功');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
