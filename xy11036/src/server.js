const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const routes = require('./routes');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.listen(config.PORT, () => {
  console.log(`心理咨询室咨询改约回访 API 服务启动成功！`);
  console.log(`服务地址: http://localhost:${config.PORT}`);
});
