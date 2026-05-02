const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const { initializeDatabase } = require('./models/init');

const donorsRouter = require('./routes/donors');
const bloodBagsRouter = require('./routes/bloodBags');
const sampleTubesRouter = require('./routes/sampleTubes');
const matchesRouter = require('./routes/matches');
const coldBoxesRouter = require('./routes/coldBoxes');
const handoversRouter = require('./routes/handovers');
const importExportRouter = require('./routes/importExport');
const auditLogsRouter = require('./routes/auditLogs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/donors', donorsRouter);
app.use('/api/blood-bags', bloodBagsRouter);
app.use('/api/sample-tubes', sampleTubesRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/cold-boxes', coldBoxesRouter);
app.use('/api/handovers', handoversRouter);
app.use('/api', importExportRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('错误:', err.message);
  res.status(500).json({ 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const startServer = async () => {
  try {
    console.log('初始化数据库...');
    await initializeDatabase();
    console.log('数据库初始化完成');

    app.listen(config.PORT, () => {
      console.log(`\n========================================`);
      console.log(`  血袋样本配对验收台 已启动`);
      console.log(`  访问地址: http://localhost:${config.PORT}`);
      console.log(`  API 地址: http://localhost:${config.PORT}/api`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

startServer();
