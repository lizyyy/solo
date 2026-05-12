const express = require('express');
const { sequelize } = require('./models');

const stallRoutes = require('./routes/stalls');
const inspectionRoutes = require('./routes/inspections');
const complaintRoutes = require('./routes/complaints');
const rectificationRoutes = require('./routes/rectifications');
const discountRoutes = require('./routes/discounts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/stalls', stallRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/rectifications', rectificationRoutes);
app.use('/api/discounts', discountRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '农贸摊位卫生扣分 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync();
    console.log('数据表同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 文档:');
      console.log('  - GET  /api/health - 健康检查');
      console.log('  - POST /api/stalls - 创建摊位');
      console.log('  - GET  /api/stalls - 获取摊位列表');
      console.log('  - POST /api/inspections - 创建检查记录');
      console.log('  - POST /api/inspections/:id/deductions - 创建扣分');
      console.log('  - POST /api/complaints - 创建投诉');
      console.log('  - POST /api/rectifications - 创建整改通知');
      console.log('  - POST /api/rectifications/:id/submit - 提交整改');
      console.log('  - POST /api/rectifications/:id/reviews - 复核整改');
      console.log('  - GET  /api/discounts/stalls/:stallId/:month - 获取摊位优惠');
      console.log('  - GET  /api/discounts/ranking - 获取排名');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
