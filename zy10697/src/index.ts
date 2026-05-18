import express from 'express';
import { initDatabase } from './models/database';
import routes from './routes';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '任务编排平台依赖跳过 API 服务运行正常' });
});

const exportsDir = path.resolve(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API 文档请参考 README.md`);
  });
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

export default app;