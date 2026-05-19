const express = require('express');
const fs = require('fs');
const path = require('path');
const { syncDatabase, User, Reagent, Inventory } = require('./models');
const logger = require('./config/logger');

const requisitionRoutes = require('./routes/requisitions');
const outboundRoutes = require('./routes/outbound');
const returnRoutes = require('./routes/returns');
const inventoryCheckRoutes = require('./routes/inventoryCheck');
const importRoutes = require('./routes/import');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`HTTP ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.use('/api/requisitions', requisitionRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/inventory-check', inventoryCheckRoutes);
app.use('/api/import', importRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '实验室试剂管理系统运行正常' });
});

app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function initializeData() {
  try {
    const adminUser = await User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
      await User.create({
        employee_id: 'ADMIN001',
        name: '系统管理员',
        role: 'admin',
        department: '实验室管理处',
        phone: '138****0001',
        email: 'ad****@***********'
      });
      logger.info('创建默认管理员用户');
    }

    const teacherUser = await User.findOne({ where: { role: 'teacher' } });
    if (!teacherUser) {
      await User.create({
        employee_id: 'T001',
        name: '张老师',
        role: 'teacher',
        department: '化学系',
        phone: '139****0001',
        email: 'z*****@***********'
      });
      logger.info('创建默认教师用户');
    }

    const studentUser = await User.findOne({ where: { role: 'student' } });
    if (!studentUser) {
      await User.create({
        employee_id: 'S2024001',
        name: '李同学',
        role: 'student',
        department: '化学系',
        phone: '137****0001',
        email: 'li******@***********'
      });
      logger.info('创建默认学生用户');
    }

    const sampleReagent = await Reagent.findOne({ where: { reagent_code: 'R001' } });
    if (!sampleReagent) {
      const reagent = await Reagent.create({
        reagent_code: 'R001',
        name: '浓硫酸',
        english_name: 'Sulfuric Acid',
        cas_no: '7664-93-9',
        formula: 'H2SO4',
        molecular_weight: 98.08,
        hazard_level: 'level_1',
        hazard_description: '强腐蚀性、强氧化性',
        safety_precautions: '佩戴防护手套、护目镜，在通风橱操作',
        storage_condition: '阴凉干燥处，远离有机物',
        unit: '瓶',
        specification: '500ml/瓶',
        manufacturer: '国药集团',
        category: '酸类',
        is_hazardous: true,
        approval_required: true,
        max_quantity_per_apply: 2
      });

      await Inventory.create({
        batch_no: 'B2024001',
        reagent_id: reagent.id,
        quantity: 10,
        original_quantity: 10,
        location: 'A-01-01',
        production_date: new Date('2024-01-01'),
        expiry_date: new Date('2026-01-01'),
        supplier: '国药集团',
        purchase_price: 85.00,
        status: 'normal',
        warning_threshold: 3
      });

      logger.info('创建示例试剂和库存');
    }

  } catch (error) {
    logger.error('初始化数据失败:', error);
  }
}

async function startServer() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const logsDir = path.join(__dirname, '../logs');
    const uploadsDir = path.join(__dirname, '../uploads');

    [dataDir, logsDir, uploadsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    await syncDatabase();
    logger.info('数据库同步完成');

    await initializeData();
    logger.info('数据初始化完成');

    app.listen(PORT, () => {
      logger.info(`服务器运行在 http://localhost:${PORT}`);
      logger.info(`API文档可参考各路由实现`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
