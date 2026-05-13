import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDatabase();

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`公益物资发放台后端服务已启动: http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api`);
});

export default app;
