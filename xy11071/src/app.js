const express = require('express');
const bodyParser = require('body-parser');
const appealRoutes = require('./routes/appealRoutes');
const { initSampleData } = require('../data/sampleData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/appeals', appealRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '快递驿站错拿申诉API运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  initSampleData();
  console.log('样例数据已初始化');
});

module.exports = app;
