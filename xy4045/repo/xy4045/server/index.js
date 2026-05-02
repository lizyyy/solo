const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(config.server.port, config.server.host, () => {
  console.log(`无密码登录训练场已启动`);
  console.log(`访问地址: http://${config.server.host}:${config.server.port}`);
});
