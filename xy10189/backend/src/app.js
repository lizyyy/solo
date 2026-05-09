const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./utils/initialize');

const app = express();
const PORT = 3001;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const returnsRouter = require('./routes/returns');
const adjustmentsRouter = require('./routes/adjustments');
const reportsRouter = require('./routes/reports');

app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/adjustments', adjustmentsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`  B2B 赊销额度管理系统 - 后端服务`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  API 路径: /api/*`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
