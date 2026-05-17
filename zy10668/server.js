const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MES返工派发API服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`MES返工派发API服务已启动，端口: ${PORT}`);
  console.log(`API基础地址: http://localhost:${PORT}/api`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
