const express = require('express');
const path = require('path');
const fs = require('fs');
const permissionRoutes = require('./routes/permissions');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/auth-permissions.db');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Auth-Temp-Permission-Service');
  next();
});

app.get('/health', (req, res) => {
  const dbExists = fs.existsSync(DB_PATH);
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: Date.now(),
      database: dbExists ? 'connected' : 'not_initialized',
      db_path: DB_PATH
    }
  });
});

app.use('/api', permissionRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
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
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║       身份认证服务临时权限二次确认 API                    ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 API 接口列表:');
  console.log('   GET    /health                           健康检查');
  console.log('   GET    /api/users                        用户列表');
  console.log('   GET    /api/packages                     权限包列表');
  console.log('   GET    /api/temp-permissions             临时权限列表');
  console.log('   GET    /api/temp-permissions/:id         临时权限详情');
  console.log('   GET    /api/temp-permissions/:id/history 操作历史');
  console.log('   POST   /api/temp-permissions             申请临时权限');
  console.log('   POST   /api/temp-permissions/:id/confirm 二次确认');
  console.log('   POST   /api/temp-permissions/:id/revoke  回收权限');
  console.log('   POST   /api/temp-permissions/batch-import 批量导入');
  console.log('   GET    /api/temp-permissions/export/csv  CSV导出');
  console.log('');

  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️  警告: 数据库未初始化');
    console.log('   请先执行: npm run init-db');
    console.log('');
  } else {
    console.log('✅ 数据库已就绪');
    console.log('');
  }

  console.log('💡 运行测试: npm test');
  console.log('');
});
