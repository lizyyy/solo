const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./config/database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ========================================
  🚌 校车调度服务已启动
  ========================================
  📍 服务地址: http://localhost:${PORT}
  📊 健康检查: http://localhost:${PORT}/api/health
  📚 API文档: http://localhost:${PORT}
  ========================================
  `);
});
