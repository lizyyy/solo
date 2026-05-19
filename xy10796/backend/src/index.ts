import express from 'express';
import cors from 'cors';
import { connectDB, db } from './config/database';
import router from './routes';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

const seedInitialData = async () => {
  await db.read();
  
  if (db.data.environments.length === 0) {
    const env1Id = uuidv4();
    const env2Id = uuidv4();
    const env3Id = uuidv4();
    const env4Id = uuidv4();
    
    db.data.environments.push(
      { id: env1Id, name: '开发环境', description: '日常开发使用环境', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: env2Id, name: '测试环境', description: '功能测试使用环境', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: env3Id, name: '预发布环境', description: '发布前验证环境', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: env4Id, name: '生产环境', description: '正式生产环境', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    );
    console.log('Initial environments created');
  }

  if (db.data.datasets.length === 0) {
    db.data.datasets.push(
      { id: uuidv4(), name: '用户基础数据', version: 'v1.0.0', importOrder: 1, status: 'published', recordCount: 1000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), name: '商品基础数据', version: 'v1.0.0', importOrder: 2, status: 'published', recordCount: 500, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), name: '订单数据', version: 'v1.0.0', importOrder: 3, status: 'published', recordCount: 2000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uuidv4(), name: '日志数据', version: 'v1.1.0', importOrder: 4, status: 'draft', recordCount: 5000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    );
    console.log('Initial datasets created');
  }
  
  await db.write();
};

const startServer = async () => {
  try {
    await connectDB();
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
