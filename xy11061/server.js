const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database/db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`影院会员部积分补录 API 系统启动成功!`);
  console.log(`========================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api`);
  console.log(`管理界面: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});

module.exports = app;