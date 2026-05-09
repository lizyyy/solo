require('dotenv').config();
const { sequelize, User, Warehouse, Product, Inventory } = require('../models');

async function init() {
  try {
    console.log('开始初始化数据库...');

    await sequelize.sync({ force: false });
    console.log('数据库表已创建/更新');

    const existingAdmin = await User.findOne({ where: { username: 'admin' } });

    if (!existingAdmin) {
      const admin = await User.create({
        username: 'admin',
        password: 'admin123',
        fullName: '系统管理员',
        role: 'admin'
      });
      console.log('管理员账户已创建: admin / admin123');

      const testUser = await User.create({
        username: 'user1',
        password: 'user123',
        fullName: '盘点员1号',
        role: 'user'
      });
      console.log('测试用户已创建: user1 / user123');

      const warehouse1 = await Warehouse.create({
        code: 'WH001',
        name: '主仓库',
        description: '公司主要存储仓库',
        address: '北京市朝阳区仓库路1号'
      });

      const warehouse2 = await Warehouse.create({
        code: 'WH002',
        name: '备用仓库',
        description: '紧急备用存储仓库',
        address: '北京市海淀区备用路2号'
      });

      console.log('测试仓库已创建');

      const products = [
        { code: 'P001', name: '笔记本电脑', barcode: '6901234567891', specification: '15.6寸 i7 16G', unit: '台' },
        { code: 'P002', name: '无线鼠标', barcode: '6901234567892', specification: '蓝牙 静音', unit: '个' },
        { code: 'P003', name: '机械键盘', barcode: '6901234567893', specification: '青轴 87键', unit: '把' },
        { code: 'P004', name: '显示器', barcode: '6901234567894', specification: '27寸 2K', unit: '台' },
        { code: 'P005', name: 'USB集线器', barcode: '6901234567895', specification: '4口 USB3.0', unit: '个' }
      ];

      const createdProducts = await Product.bulkCreate(products);
      console.log('测试商品已创建');

      const inventories = [];
      createdProducts.forEach((product, index) => {
        inventories.push({
          warehouseId: warehouse1.id,
          productId: product.id,
          quantity: 100 + index * 10,
          version: 1
        });
      });

      await Inventory.bulkCreate(inventories);
      console.log('测试库存数据已创建');

      console.log('初始化完成！');
      console.log('默认账户：');
      console.log('  管理员: admin / admin123');
      console.log('  普通用户: user1 / user123');
    } else {
      console.log('数据库已存在数据，跳过初始化');
    }

    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

init();
