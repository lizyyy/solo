const express = require('express');
const cors = require('cors');
const path = require('path');

const renewalRoutes = require('./routes/renewal');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/renewal', renewalRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  客户成功续约 API 服务已启动`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  看板界面: http://localhost:${PORT}/`);
  console.log(`  健康检查: http://localhost:${PORT}/api/dashboard/health`);
  console.log(`  API 文档: http://localhost:${PORT}/api-docs`);
  console.log(`========================================\n`);
});

module.exports = app;
