const express = require('express');
const visitorRoutes = require('./routes/visitorRoutes');
const revocationRoutes = require('./routes/revocationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/visitors', visitorRoutes);
app.use('/api/revocations', revocationRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '园区访客系统批量撤销API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
