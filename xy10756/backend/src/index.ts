import express from 'express';
import cors from 'cors';
import { sequelize } from './config/database';
import afterSalesRoutes from './routes/afterSalesRoutes';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/after-sales', afterSalesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '售后退款状态机服务运行正常' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
  }
}

startServer();