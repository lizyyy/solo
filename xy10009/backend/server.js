const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./models');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const warehouseRoutes = require('./routes/warehouses');
const productRoutes = require('./routes/products');
const countTaskRoutes = require('./routes/countTasks');
const historyRoutes = require('./routes/history');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/count-tasks', countTaskRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    await sequelize.sync({ alter: true });
    console.log('数据库同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
