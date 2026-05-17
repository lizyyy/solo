const express = require('express');
const { sequelize } = require('./models');
const compensationRoutes = require('./routes/compensationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/compensation', compensationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '会议预约后端会议室释放补偿服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: false });
    console.log('数据库同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API文档:
        POST   /api/compensation           - 创建补偿记录
        GET    /api/compensation           - 获取记录列表
        GET    /api/compensation/:id       - 获取记录详情
        GET    /api/compensation/:id/history - 获取记录历史
        POST   /api/compensation/:id/release - 申请释放
        POST   /api/compensation/:id/approve - 审批释放
        POST   /api/compensation/:id/start-compensation - 启动补偿
        POST   /api/compensation/:id/complete - 完成补偿
        POST   /api/compensation/:id/reject - 拒绝记录
        GET    /api/compensation/conflicts/check - 检查冲突
        POST   /api/compensation/export    - 导出记录
      `);
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
