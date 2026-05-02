import express from 'express';
import { getDatabase } from './storage/database';
import { createUser, getUserByUsername, getAllUsers } from './storage/userRepository';
import { createStore, getStoreById } from './storage/storeRepository';
import { createPool } from './storage/poolRepository';
import { UserRole, User } from './types';
import storeRoutes from './routes/storeRoutes';
import poolRoutes from './routes/poolRoutes';
import sampleRecordRoutes from './routes/sampleRecordRoutes';
import ticketRoutes from './routes/ticketRoutes';
import importExportRoutes from './routes/importExportRoutes';
import { createMockUserMiddleware } from './routes/middleware';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function initializeSystem() {
  console.log('初始化数据库连接...');
  getDatabase();

  let adminUser = getUserByUsername('admin');
  
  if (!adminUser) {
    console.log('创建管理员用户...');
    
    const tempAdmin: User = {
      id: 'temp-admin',
      username: 'system',
      role: UserRole.ADMIN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    adminUser = createUser('admin', UserRole.ADMIN, undefined, tempAdmin);
    console.log('管理员用户创建成功:', adminUser.id);

    const supervisorUser = createUser('supervisor', UserRole.SUPERVISOR, undefined, tempAdmin);
    console.log('督导用户创建成功:', supervisorUser.id);

    const store1 = createStore(
      '阳光游泳馆',
      '北京市朝阳区阳光路88号',
      '张经理',
      '13800138001',
      tempAdmin
    );
    console.log('门店1创建成功:', store1.id);

    const store2 = createStore(
      '碧波游泳馆',
      '北京市海淀区碧波路66号',
      '李经理',
      '13800138002',
      tempAdmin
    );
    console.log('门店2创建成功:', store2.id);

    const staff1 = createUser('staff_sunny', UserRole.STORE_STAFF, store1.id, tempAdmin);
    console.log('门店1员工创建成功:', staff1.id);

    const staff2 = createUser('staff_bibo', UserRole.STORE_STAFF, store2.id, tempAdmin);
    console.log('门店2员工创建成功:', staff2.id);

    createPool(store1.id, '比赛池', '标准比赛池', 2500, tempAdmin);
    createPool(store1.id, '训练池', '训练池', 1800, tempAdmin);
    createPool(store1.id, '儿童池', '儿童游乐池', 500, tempAdmin);
    console.log('门店1泳池创建成功');

    createPool(store2.id, '大池', '标准池', 2000, tempAdmin);
    createPool(store2.id, '小池', '热身池', 800, tempAdmin);
    console.log('门店2泳池创建成功');
  }

  const users = getAllUsers();
  console.log('\n可用用户列表:');
  users.forEach(u => {
    console.log(`  - ${u.username} (${u.role})`);
  });
}

let defaultAdmin: User | undefined;

app.use((req, res, next) => {
  if (!defaultAdmin) {
    defaultAdmin = getUserByUsername('admin');
  }
  next();
});

app.use(createMockUserMiddleware(undefined));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '水质整改闭环 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (req, res) => {
  const users = getAllUsers();
  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      storeId: u.storeId
    }))
  });
});

app.use('/api/stores', storeRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/sample-records', sampleRecordRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/import-export', importExportRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  水质整改闭环 API 服务启动成功');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log('========================================\n');
  
  initializeSystem();
  
  console.log('\n使用提示:');
  console.log('  - 在请求头中添加 X-User-Id 来指定操作用户');
  console.log('  - 例如: curl -H "X-User-Id: <用户ID>" http://localhost:3000/api/stores');
  console.log('  - 查看所有用户: curl http://localhost:3000/api/users');
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});
