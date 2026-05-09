const express = require('express');
const { sequelize } = require('./models');
const seedDatabase = require('./utils/seed');
const { requestIdMiddleware } = require('./middlewares/audit');

const authRoutes = require('./routes/auth');
const recordsRoutes = require('./routes/records');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(express.json());
app.use(requestIdMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '多租户数据权限审计 API 运行中',
    timestamp: new Date().toISOString()
  });
});

app.use((error, req, res, next) => {
  console.error('未处理的错误:', error);
  
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    requestId: req.id
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    const seedData = await seedDatabase();
    global.__seedData = seedData;
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  多租户数据权限审计 API 已启动`);
      console.log(`  端口: ${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
      console.log(`测试账号:`);
      console.log(`  管理员: admin / admin123`);
      console.log(`  客服: cs001 / cs123456`);
      console.log(`  租户A用户: user_a_01 / user123`);
      console.log(`  租户B用户: user_b_01 / user123\n`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
