const express = require('express');
const { sequelize } = require('./models');
const responseHandler = require('./middleware/response');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHandler);

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.error('服务器内部错误', 500);
});

async function bootstrap() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据表同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

bootstrap();
