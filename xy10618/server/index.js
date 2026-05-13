const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./database');
const { initSampleData } = require('./utils/sampleData');
const { checkIdempotency } = require('./middleware/idempotency');

const packagesRoutes = require('./routes/packages');
const schedulesRoutes = require('./routes/schedules');
const leaveRoutes = require('./routes/leaveDeductions');
const transferRoutes = require('./routes/transfers');
const refundRoutes = require('./routes/refunds');
const ledgerRoutes = require('./routes/ledger');
const logsRoutes = require('./routes/logs');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(checkIdempotency);

app.use('/api/packages', packagesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '私教课包管理系统API运行正常' });
});

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    await initSampleData();
    console.log('样例数据初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
