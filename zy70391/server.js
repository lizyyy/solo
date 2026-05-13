const express = require('express');
const path = require('path');
const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

db.init();

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.listen(PORT, () => {
  console.log(`临时权限到期API服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API根路径: http://localhost:${PORT}/api`);
});
