const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./models/database');
const { seedData } = require('./data/seed');

const tablesRouter = require('./routes/tables');
const scriptsRouter = require('./routes/scripts');
const hostsRouter = require('./routes/hosts');
const reservationsRouter = require('./routes/reservations');
const waitlistRouter = require('./routes/waitlist');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function startServer() {
  await initDatabase();
  await seedData();

  app.use(cors());
  app.use(express.json());

  app.use('/api/tables', tablesRouter);
  app.use('/api/scripts', scriptsRouter);
  app.use('/api/hosts', hostsRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/waitlist', waitlistRouter);

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '桌游吧调度台后端服务运行中' });
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, errors: ['服务器内部错误'] });
  });

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  桌游吧包场拼桌调度台 - 后端服务`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  API文档: http://localhost:${PORT}/api/health`);
    console.log(`========================================\n`);
  });
}

startServer().catch(console.error);
