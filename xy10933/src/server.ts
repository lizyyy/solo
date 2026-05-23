import express from 'express';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  影棚器材借还 API 服务启动成功！`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  API 前缀: http://localhost:${PORT}/api`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
