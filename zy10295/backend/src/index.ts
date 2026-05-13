import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database';
import { createDemoData } from './services/demoData';
import tiresRouter from './routes/tires';
import vehiclesRouter from './routes/vehicles';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDatabase();
createDemoData();

app.use('/api/tires', tiresRouter);
app.use('/api/vehicles', vehiclesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '轮胎翻新管理系统 API 运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
