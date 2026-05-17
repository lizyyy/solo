import 'reflect-metadata';
import express from 'express';
import { AppDataSource } from './data-source';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

export default app;
