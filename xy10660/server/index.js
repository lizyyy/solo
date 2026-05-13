const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');
const licenseRoutes = require('./routes/licenses');
const companyRoutes = require('./routes/companies');
const logRoutes = require('./routes/logs');
const demoRoutes = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/licenses', licenseRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/demo', demoRoutes);

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
  }
}

startServer();
