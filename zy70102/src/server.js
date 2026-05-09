const express = require('express');
const config = require('./config');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const devicesRouter = require('./routes/devices');
const commandsRouter = require('./routes/commands');
const receiptsRouter = require('./routes/receipts');
const rulesRouter = require('./routes/rules');
const alarmsRouter = require('./routes/alarms');
const auditRouter = require('./routes/audit');
const eventsRouter = require('./routes/events');

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: '水泵远程启停审计 API',
    version: '1.0.0',
    endpoints: {
      devices: '/api/devices',
      commands: '/api/commands',
      receipts: '/api/receipts',
      rules: '/api/rules',
      alarms: '/api/alarms',
      audit: '/api/audit',
      events: '/api/events',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/devices', devicesRouter);
app.use('/api/commands', commandsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/events', eventsRouter);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path,
  });
});

const startServer = async () => {
  try {
    const { initDatabase } = require('./database/connection');
    await initDatabase();
    
    const { initDatabase: initTables } = require('./database/init');
    initTables();
    
    app.listen(config.server.port, () => {
      console.log(`水泵远程启停审计 API 已启动`);
      console.log(`服务地址: http://localhost:${config.server.port}`);
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
};

startServer();
