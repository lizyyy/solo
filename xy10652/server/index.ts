import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database';
import { seedData } from './seed';
import routes from './routes';

const app = express();
const PORT = 3001;

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

initDatabase();
seedData();

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`供应链样品评审管理系统服务已启动: http://localhost:${PORT}`);
});
