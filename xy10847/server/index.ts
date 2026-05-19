import express from 'express';
import cors from 'cors';
import path from 'path';
import taskRoutes from './routes/tasks';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/exports', express.static(path.join(__dirname, '../exports')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`语音转写回调台服务运行在端口 ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});

export default app;
