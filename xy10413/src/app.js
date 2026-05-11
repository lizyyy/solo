const express = require('express');
const fs = require('fs');
const path = require('path');
const { sequelize, ToleranceRule, Supplier } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const suppliersRouter = require('./routes/suppliers');
const purchaseOrdersRouter = require('./routes/purchase-orders');
const arrivalsRouter = require('./routes/arrivals');
const inspectionsRouter = require('./routes/inspections');
const discrepanciesRouter = require('./routes/discrepancies');
const inventoryRouter = require('./routes/inventory');
const toleranceRulesRouter = require('./routes/tolerance-rules');

app.use('/api/suppliers', suppliersRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/arrivals', arrivalsRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/discrepancies', discrepanciesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/tolerance-rules', toleranceRulesRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '供应商到货短溢 API 运行中', version: '1.0.0' });
});

async function initDatabase() {
  await sequelize.sync({ alter: true });
  
  const existingDefault = await ToleranceRule.findOne({ where: { isDefault: true } });
  if (!existingDefault) {
    await ToleranceRule.create({
      ruleName: '默认容差规则',
      toleranceType: 'percentage',
      toleranceValue: 5,
      isDefault: true
    });
  }
  
  const existingSupplier = await Supplier.findOne({ where: { code: 'S001' } });
  if (!existingSupplier) {
    await Supplier.create({
      name: '示例供应商A',
      code: 'S001',
      contact: '张三',
      phone: '13800138001'
    });
  }
  
  const existingSupplierB = await Supplier.findOne({ where: { code: 'S002' } });
  if (!existingSupplierB) {
    await Supplier.create({
      name: '示例供应商B',
      code: 'S002',
      contact: '李四',
      phone: '13800138002'
    });
  }
  
  console.log('数据库初始化完成');
}

app.listen(PORT, async () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  
  try {
    await initDatabase();
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
});

module.exports = app;
