const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

const { initDB } = require('./database/connection');
const partRoutes = require('./routes/parts');
const engineerRoutes = require('./routes/engineers');
const workOrderRoutes = require('./routes/workorders');
const loanRoutes = require('./routes/loans');
const reportRoutes = require('./routes/reports');

app.use(cors());
app.use(express.json());

app.use('/api/parts', partRoutes);
app.use('/api/engineers', engineerRoutes);
app.use('/api/workorders', workOrderRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await initDB();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务启动成功: http://localhost:${PORT}`);
      console.log('健康检查: http://localhost:${PORT}/health');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
