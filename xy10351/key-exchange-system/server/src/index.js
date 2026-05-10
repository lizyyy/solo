const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const sequelize = require('./config/database');
const keyRoutes = require('./routes/keys');
const orderRoutes = require('./routes/orders');
const auditRoutes = require('./routes/audit');

const { Key, Order, ExchangeRecord, AuditLog } = require('./models');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/keys', keyRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');
    
    const keyCount = await Key.count();
    if (keyCount === 0) {
      console.log('初始化样例数据...');
      await seedSampleData();
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

async function seedSampleData() {
  const keys = await Key.bulkCreate([
    { keyCode: 'K001', customerName: '张三', address: '阳光花园1号楼101', cabinetNumber: 'A-01' },
    { keyCode: 'K002', customerName: '李四', address: '阳光花园2号楼202', cabinetNumber: 'A-02' },
    { keyCode: 'K003', customerName: '王五', address: '锦绣家园3号楼303', cabinetNumber: 'B-01' },
    { keyCode: 'K004', customerName: '赵六', address: '锦绣家园4号楼404', cabinetNumber: 'B-02' },
    { keyCode: 'K005', customerName: '钱七', address: '幸福里5号楼505', cabinetNumber: 'C-01' },
  ]);
  
  const orders = await Order.bulkCreate([
    {
      orderNumber: 'ORD20240101001',
      customerName: '张三',
      serviceType: '日常保洁',
      scheduledDate: moment().add(1, 'day').toDate(),
      cleanerName: '保洁员A',
      status: 'pending',
      keyId: keys[0].id,
    },
    {
      orderNumber: 'ORD20240101002',
      customerName: '李四',
      serviceType: '深度保洁',
      scheduledDate: moment().add(2, 'days').toDate(),
      cleanerName: '保洁员B',
      status: 'pending',
      keyId: keys[1].id,
    },
    {
      orderNumber: 'ORD20240101003',
      customerName: '王五',
      serviceType: '日常保洁',
      scheduledDate: moment().subtract(1, 'day').toDate(),
      cleanerName: '保洁员C',
      status: 'completed',
      keyId: keys[2].id,
    },
  ]);
  
  console.log('样例数据初始化完成');
  console.log('- 钥匙:', keys.length, '把');
  console.log('- 订单:', orders.length, '个');
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 文档:`);
    console.log(`  GET  /api/health - 健康检查`);
    console.log(`  GET  /api/keys - 获取所有钥匙`);
    console.log(`  GET  /api/orders - 获取所有订单`);
    console.log(`  GET  /api/audit/logs - 获取审计日志`);
  });
});
