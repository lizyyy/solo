import express from 'express';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

initDatabase();

app.use(express.json());
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`工艺参数推荐回看系统已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

export default app;
