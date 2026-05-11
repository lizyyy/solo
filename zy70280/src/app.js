const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const { sequelize } = require('./models');
const { errorHandler } = require('./utils/errorHandler');

const valvesRouter = require('./routes/valves');
const repairOrdersRouter = require('./routes/repair-orders');
const resourcesRouter = require('./routes/resources');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '自来水抢修阀门影响分析API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/valves', valvesRouter);
app.use('/api/repair-orders', repairOrdersRouter);
app.use('/api/resources', resourcesRouter);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `未找到接口 ${req.originalUrl}`
    }
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('[Database] 数据库连接成功');
    
    await sequelize.sync({ force: false });
    console.log('[Database] 数据表同步完成');
    
    app.listen(PORT, () => {
      console.log(`[Server] 服务器运行在 http://localhost:${PORT}`);
      console.log(`[Docs] API文档: http://localhost:${PORT}/api-docs`);
      console.log(`[Health] 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Error] 启动失败:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;