const express = require('express');
const cors = require('cors');
const { initDB, db } = require('./database');
const routes = require('./routes');
const initSampleData = require('./sampleData');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDB();
initSampleData();

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 门店员工借调排班台 - 后端服务`);
  console.log(`📡 服务器运行在: http://localhost:${PORT}`);
  console.log(`📊 API地址: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
});
