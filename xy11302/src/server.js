const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
🏠  民宿运营后端系统启动成功
📡  服务地址: http://localhost:${PORT}
📚  API文档: http://localhost:${PORT}/api-docs
📅  启动时间: ${new Date().toLocaleString('zh-CN')}
============================================

📖 使用说明:
1. 初始化数据库: npm run init-db
2. 导入样例数据: npm run import-sample
3. 启动服务: npm start

🔧 主要接口:
- POST /api/import/cleaning  - 导入保洁记录CSV
- GET  /api/cleaning          - 查询保洁记录
- POST /api/cleaning/:id/review - 复核保洁记录
- GET  /api/export/cleaning   - 导出保洁记录CSV
- POST /api/settlements/generate - 生成月度结算
- POST /api/complaints        - 登记客诉
- POST /api/reworks           - 登记返工
- GET  /api/logs              - 查看操作日志
  `);
});

module.exports = app;