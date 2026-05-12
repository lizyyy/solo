import express from 'express';
import { initDB } from './models';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/v1', routes);

const startServer = async () => {
  try {
    await initDB();
    console.log('数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API文档: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

export default app;
