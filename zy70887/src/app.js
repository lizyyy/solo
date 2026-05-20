const express = require('express');
const bodyParser = require('body-parser');

const taskRoutes = require('./routes/taskRoutes');
const materialRoutes = require('./routes/materialRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '法务合同盖章排队 API 服务',
    version: '1.0.0',
    endpoints: {
      tasks: '/api/tasks',
      materials: '/api/materials',
      audit: '/api/audit'
    }
  });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/audit', auditRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '端点不存在',
    message: `未找到 ${req.method} ${req.path}`
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}`);
});

module.exports = app;
