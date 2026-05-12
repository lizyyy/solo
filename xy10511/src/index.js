const express = require('express');
const apiRoutes = require('./routes/api');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await db.loadDb();
    next();
  } catch (err) {
    console.error('数据库初始化失败:', err);
    res.status(500).json({ success: false, error: '数据库初始化失败' });
  }
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '物业设备保修管理系统 API',
    version: '1.0.0',
    endpoints: {
      assets: '/api/assets',
      vendors: '/api/vendors',
      repairs: '/api/repairs',
      reports: '/api/reports',
      health: '/api/health'
    },
    documentation: '请查看项目 README.md 文件获取详细使用说明'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    code: 'INTERNAL_SERVER_ERROR',
    details: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     物业设备保修管理系统 API 服务已启动                      ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                           ║
║  健康检查: http://localhost:${PORT}/api/health                ║
║  API 文档: http://localhost:${PORT}/                         ║
╠════════════════════════════════════════════════════════════╣
║  演示脚本:                                                  ║
║    - npm run demo          运行主演示流程                    ║
║    - npm run demo-failure  运行失败场景演示                  ║
║    - npm run seed          初始化演示数据                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});
