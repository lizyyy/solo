const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           社区共享活动室预约系统已启动                        ║
╠════════════════════════════════════════════════════════════╣
║  用户预约页面: http://localhost:${PORT}/                      ║
║  管理员页面:   http://localhost:${PORT}/admin                 ║
║  API接口:     http://localhost:${PORT}/api/*                  ║
╠════════════════════════════════════════════════════════════╣
║  首次运行请执行: npm run init  (初始化房间数据)               ║
║  安装依赖:      npm install                                   ║
║  启动服务:      npm start                                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});
