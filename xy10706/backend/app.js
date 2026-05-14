require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const quotaRoutes = require('./routes/quota');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/quota', quotaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');

    const { Customer, Package, ApiEndpoint, CustomerPackage } = require('./models');

    const customers = await Customer.count();
    if (customers === 0) {
      console.log('Seeding initial data...');

      const basicPackage = await Package.create({
        name: '基础版',
        description: '适合小型团队的基础接口调用套餐',
        monthlyQuota: 10000,
        burstThreshold: 50,
        burstWindowMinutes: 5,
        maxRetries: 3,
        pricePerCall: 0.01
      });

      const proPackage = await Package.create({
        name: '专业版',
        description: '适合成长型企业的专业接口调用套餐',
        monthlyQuota: 100000,
        burstThreshold: 200,
        burstWindowMinutes: 5,
        maxRetries: 5,
        pricePerCall: 0.005
      });

      const enterprisePackage = await Package.create({
        name: '企业版',
        description: '适合大型企业的高级接口调用套餐',
        monthlyQuota: 1000000,
        burstThreshold: 500,
        burstWindowMinutes: 5,
        maxRetries: 10,
        pricePerCall: 0.002
      });

      const demoCustomer = await Customer.create({
        name: '演示客户',
        email: 'demo@example.com',
        apiKey: 'demo-api-key-12345'
      });

      await CustomerPackage.create({
        CustomerId: demoCustomer.id,
        PackageId: proPackage.id,
        startDate: new Date()
      });

      await ApiEndpoint.bulkCreate([
        { path: '/api/v1/users', method: 'GET', description: '获取用户列表', costPerCall: 1, isIdempotent: true },
        { path: '/api/v1/users', method: 'POST', description: '创建用户', costPerCall: 2, isIdempotent: false },
        { path: '/api/v1/users/:id', method: 'GET', description: '获取用户详情', costPerCall: 1, isIdempotent: true },
        { path: '/api/v1/users/:id', method: 'PUT', description: '更新用户', costPerCall: 2, isIdempotent: false },
        { path: '/api/v1/orders', method: 'GET', description: '获取订单列表', costPerCall: 1, isIdempotent: true },
        { path: '/api/v1/orders', method: 'POST', description: '创建订单', costPerCall: 5, isIdempotent: false },
        { path: '/api/v1/products', method: 'GET', description: '获取产品列表', costPerCall: 1, isIdempotent: true },
        { path: '/api/v1/reports', method: 'GET', description: '生成报表', costPerCall: 10, isIdempotent: false }
      ]);

      console.log('Initial data seeded successfully.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDatabase();
});

module.exports = app;
