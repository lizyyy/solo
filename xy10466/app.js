const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const complaintsRouter = require('./routes/complaints');

require('./models/associations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/complaints', complaintsRouter);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '餐饮外卖差评API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('全局错误处理:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');
    
    app.listen(PORT, () => {
      console.log(`餐饮外卖差评API服务已启动，端口: ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API端点:`);
      console.log(`  POST  http://localhost:${PORT}/api/complaints/submit  - 提交差评`);
      console.log(`  POST  http://localhost:${PORT}/api/complaints/:id/followup  - 记录回访`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/:id  - 获取详情`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/reason-ranking  - 差评原因排行`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/compensation  - 补偿统计`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/unfollowed-up  - 未回访清单`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/dish-improvement  - 菜品改进建议`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/closed-count  - 已结案统计`);
      console.log(`  GET   http://localhost:${PORT}/api/complaints/statistics/overview  - 统计概览`);
    });
  } catch (error) {
    console.error('启动服务失败:', error);
    process.exit(1);
  }
};

startServer();
