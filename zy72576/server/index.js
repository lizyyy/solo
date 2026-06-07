const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '分桶校准概率回看系统',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  分桶校准概率回看系统 已启动`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  API文档:  http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

module.exports = app;
