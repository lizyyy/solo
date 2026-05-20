const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/exports', express.static(path.join(__dirname, '../exports')));
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`疫苗预约改签API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
