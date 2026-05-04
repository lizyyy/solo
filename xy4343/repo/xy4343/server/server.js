const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// 初始化数据库
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../client')));

// 路由
const levelsRouter = require('./routes/levels');
const sessionsRouter = require('./routes/sessions');
const exportsRouter = require('./routes/exports');

app.use('/api/levels', levelsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/exports', exportsRouter);

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`博物馆安保训练系统已启动`);
  console.log(`服务器地址: http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});
