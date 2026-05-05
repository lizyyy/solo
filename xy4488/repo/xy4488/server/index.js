const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const routes = require('./routes');
const { runScreening } = require('./screening');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', routes);

db.initDB().then(() => {
  console.log('数据库初始化完成');
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`请打开浏览器访问 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
