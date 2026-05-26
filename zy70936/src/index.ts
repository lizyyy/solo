import express from 'express';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();

app.use(express.json());
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`药店购药追踪系统已启动，端口: ${PORT}`);
  console.log(`健康检查: GET http://localhost:${PORT}/api/health`);
});
