const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────────┐
  │  曲线拟合错题归因系统 已启动                      │
  │  服务地址: http://localhost:${PORT}                  │
  │  API 前缀: /api                                   │
  │  前端页面: http://localhost:${PORT}/                 │
  └─────────────────────────────────────────────────┘
  `);
});

module.exports = app;
