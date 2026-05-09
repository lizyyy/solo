const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const db = require('./database/connection');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const reportsRouter = require('./routes/reports');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      status: 'healthy',
      timestamp: Date.now()
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await db.initialize();
    
    app.listen(config.PORT, () => {
      console.log(`\n========================================`);
      console.log(`  客服跟进管理系统`);
      console.log(`  服务已启动: http://localhost:${config.PORT}`);
      console.log(`  API地址: http://localhost:${config.PORT}/api`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
