import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import initDatabase from './config/database.js';

// 导入路由
import questionsRouter from './routes/questions.js';
import practiceRouter from './routes/practice.js';
import wrongNotesRouter from './routes/wrongNotes.js';
import progressRouter from './routes/progress.js';
import reportsRouter from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初始化数据库
const db = initDatabase();
app.set('db', db);

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// API 路由
app.use('/api/questions', questionsRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/wrong-notes', wrongNotesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/reports', reportsRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 乐理练习台服务器运行在端口 ${PORT}`);
  console.log(`   API 文档: http://localhost:${PORT}/api/health`);
});

export default app;
