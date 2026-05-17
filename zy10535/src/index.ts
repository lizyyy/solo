import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppDataSource } from './database/data-source';
import scheduleRoutes from './routes/schedules';
import masterRoutes from './routes/master';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/schedules', scheduleRoutes);
app.use('/api/master', masterRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API文档:');
      console.log('  GET  /health - 健康检查');
      console.log('  POST /api/master/customers - 创建客户');
      console.log('  GET  /api/master/customers - 获取客户列表');
      console.log('  POST /api/master/persons - 创建负责人');
      console.log('  GET  /api/master/persons - 获取负责人列表');
      console.log('  POST /api/schedules - 创建回访排期');
      console.log('  GET  /api/schedules - 获取排期列表');
      console.log('  GET  /api/schedules/:id - 获取排期详情');
      console.log('  POST /api/schedules/:id/confirm - 确认排期');
      console.log('  POST /api/schedules/:id/status - 更新排期状态');
      console.log('  POST /api/schedules/:id/delay - 创建延期记录');
      console.log('  PUT  /api/schedules/:id - 人工修正排期');
      console.log('  POST /api/schedules/:id/cancel - 取消排期');
      console.log('  POST /api/schedules/:id/report - 创建回访报告');
      console.log('  POST /api/schedules/export - 导出排期数据');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

export default app;
