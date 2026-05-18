const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const transferRoutes = require('./routes/transfers');
app.use('/api/transfers', transferRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '健身私教馆私教课转让 API 运行正常' });
});

app.listen(PORT, () => {
  console.log(`健身私教馆私教课转让 API 服务已启动: http://localhost:${PORT}`);
});

module.exports = app;
