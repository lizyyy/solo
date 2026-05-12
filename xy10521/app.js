const express = require('express');
const app = express();
const config = require('./config.json');
const routes = require('./src/routes');
const { initializeData } = require('./src/utils/initializer');

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', appName: config.appName, timestamp: new Date().toISOString() });
});

initializeData().then(() => {
  app.listen(config.port, () => {
    console.log(`${config.appName} 启动成功，监听端口 ${config.port}`);
    console.log(`健康检查: http://localhost:${config.port}/health`);
    console.log(`API 文档示例: http://localhost:${config.port}/api/demo/info`);
  });
});