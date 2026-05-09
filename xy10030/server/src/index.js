import express from 'express';
import cors from 'cors';
import { initDatabase } from './database/index.js';
import { config } from './config/index.js';

import eventsRouter from './routes/events.js';
import registrationsRouter from './routes/registrations.js';
import logsRouter from './routes/logs.js';
import tasksRouter from './routes/tasks.js';
import reportsRouter from './routes/reports.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: '服务器内部错误',
      code: 'INTERNAL_ERROR'
    },
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: '接口不存在',
      code: 'NOT_FOUND'
    },
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    initDatabase();
    
    app.listen(config.port, () => {
      console.log(`\n========================================`);
      console.log(`  活动报名系统已启动`);
      console.log(`  后端服务: http://localhost:${config.port}`);
      console.log(`  健康检查: http://localhost:${config.port}/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
