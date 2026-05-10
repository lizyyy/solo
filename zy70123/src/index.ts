import express from 'express';
import routes from './routes';
import { taskScheduler } from './services/TaskScheduler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

taskScheduler.start(5);

process.on('SIGTERM', () => {
  taskScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  taskScheduler.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`影厅排片冲突 API 服务已启动，端口: ${PORT}`);
});

export default app;
