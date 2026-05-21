const express = require('express');
const cors = require('cors');
const path = require('path');
const { initTables } = require('./database/schema');
const policyRoutes = require('./routes/policies');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../data');
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/policies', policyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initTables().then(() => {
  console.log('数据库表初始化完成');
  
  app.listen(PORT, () => {
    console.log(`制度审批发布 API 服务运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
