const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('./routes');
require('./database');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log(`知情同意版本 API 服务器运行在 http://${HOST}:${PORT}`);
  console.log(`健康检查: http://${HOST}:${PORT}/health`);
  console.log(`API 基础地址: http://${HOST}:${PORT}/api`);
});