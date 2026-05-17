const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

require('./database/db');

app.use(express.json());

app.use('/api/transfers', require('./routes/transfers'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '报销系统预算科目调拨服务运行正常' });
});

app.listen(port, () => {
  console.log(`服务运行在 http://localhost:${port}`);
});

module.exports = app;
