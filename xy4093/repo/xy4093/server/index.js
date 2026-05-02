import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './database/db.js';

import roomsRouter from './routes/rooms.js';
import guestsRouter from './routes/guests.js';
import shipsRouter from './routes/ships.js';
import suppliesRouter from './routes/supplies.js';
import batchesRouter from './routes/batches.js';
import exportRouter from './routes/export.js';
import { Scheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  getDatabase();
  console.log('SQLite 数据库连接成功');
} catch (error) {
  console.error('数据库初始化失败:', error);
  process.exit(1);
}

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '台风撤房物资联动表系统运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  try {
    const status = Scheduler.getEvacuationStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api/rooms', roomsRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/ships', shipsRouter);
app.use('/api/supplies', suppliesRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/export', exportRouter);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  🏝️  台风撤房物资联动表系统                              ║
║                                                           ║
║  后端服务已启动                                          ║
║  API地址: http://localhost:${PORT}                        ║
║  健康检查: http://localhost:${PORT}/api/health            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});
