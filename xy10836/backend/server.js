const express = require('express');
const cors = require('cors');
const path = require('path');
const leaseRoutes = require('./src/routes/leaseRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/leases', leaseRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '短期密钥租约服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`短期密钥租约服务启动成功`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api/leases`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
