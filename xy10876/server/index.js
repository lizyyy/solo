const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const { initDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

initDatabase();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           退款异常处理 API 服务已启动                           ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  控制台地址: http://localhost:${PORT}                            ║
║  API 前缀: http://localhost:${PORT}/api                         ║
╠══════════════════════════════════════════════════════════════╣
║  主要接口:                                                     ║
║    POST /api/refunds          - 创建退款单                     ║
║    GET  /api/refunds          - 查询退款单列表                 ║
║    POST /api/refunds/:id/submit - 提交渠道                    ║
║    POST /api/refunds/:id/query  - 查询渠道状态                ║
║    POST /api/refunds/:id/review - 人工复核                    ║
║    POST /api/refunds/:id/fix    - 修复脏数据                  ║
║    GET  /api/logs              - 查看操作日志                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
