import express from 'express';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database';
import priceListService from './services/priceListService';
import routes from './routes';

const app = express();
const PORT = 3000;

app.use(express.json());

const dataDir = path.resolve(__dirname, '../data');
const exportDir = path.resolve(__dirname, '../data/exports');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '连锁门店中台门店价目表生效 API' });
});

const startServer = async () => {
  await initDatabase();
  await priceListService.initStores();
  
  app.listen(PORT, () => {
    console.log(`连锁门店中台门店价目表生效 API 已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
  });
};

startServer();
