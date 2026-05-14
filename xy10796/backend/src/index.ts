import express from 'express';
import cors from 'cors';
import { sequelize, connectDB } from './config/database';
import router from './routes';
import { Environment, EnvironmentStatus } from './models/Environment';
import { DatasetVersion, DatasetStatus } from './models/DatasetVersion';
import './models';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

const seedInitialData = async () => {
  const environmentsCount = await Environment.count();
  if (environmentsCount === 0) {
    await Environment.bulkCreate([
      { name: '开发环境', description: '日常开发使用环境', status: EnvironmentStatus.ACTIVE },
      { name: '测试环境', description: '功能测试使用环境', status: EnvironmentStatus.ACTIVE },
      { name: '预发布环境', description: '发布前验证环境', status: EnvironmentStatus.ACTIVE },
      { name: '生产环境', description: '正式生产环境', status: EnvironmentStatus.ACTIVE },
    ]);
    console.log('Initial environments created');
  }

  const datasetsCount = await DatasetVersion.count();
  if (datasetsCount === 0) {
    await DatasetVersion.bulkCreate([
      { name: '用户基础数据', version: 'v1.0.0', importOrder: 1, status: DatasetStatus.PUBLISHED, recordCount: 1000 },
      { name: '商品基础数据', version: 'v1.0.0', importOrder: 2, status: DatasetStatus.PUBLISHED, recordCount: 500 },
      { name: '订单数据', version: 'v1.0.0', importOrder: 3, status: DatasetStatus.PUBLISHED, recordCount: 2000 },
      { name: '日志数据', version: 'v1.1.0', importOrder: 4, status: DatasetStatus.DRAFT, recordCount: 5000 },
    ]);
    console.log('Initial datasets created');
  }
};

const startServer = async () => {
  try {
    await connectDB();
    await sequelize.sync({ force: false });
    await seedInitialData();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API docs: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
