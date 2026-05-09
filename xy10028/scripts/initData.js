const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../server/models');

async function initData() {
  console.log('开始初始化数据...');

  try {
    await db.sequelize.sync({ force: false });

    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await db.User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        id: uuidv4(),
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        role: 'admin',
        isActive: true
      }
    });

    console.log('管理员账号: admin / admin123');

    const stores = [
      { id: 'store-1', name: '总店', code: 'ST001', address: '北京市朝阳区', phone: '010-12345678' },
      { id: 'store-2', name: '分店A', code: 'ST002', address: '上海市浦东新区', phone: '021-12345678' },
      { id: 'store-3', name: '分店B', code: 'ST003', address: '广州市天河区', phone: '020-12345678' }
    ];

    for (const store of stores) {
      await db.Store.findOrCreate({
        where: { code: store.code },
        defaults: store
      });
    }
    console.log('门店数据已初始化');

    const products = [
      { id: 'prod-1', name: '商品A', sku: 'SKU001', category: '分类1', unit: '件', basePrice: 99.99, description: '商品A描述' },
      { id: 'prod-2', name: '商品B', sku: 'SKU002', category: '分类1', unit: '件', basePrice: 199.99, description: '商品B描述' },
      { id: 'prod-3', name: '商品C', sku: 'SKU003', category: '分类2', unit: '件', basePrice: 299.99, description: '商品C描述' },
      { id: 'prod-4', name: '商品D', sku: 'SKU004', category: '分类2', unit: '件', basePrice: 399.99, description: '商品D描述' },
      { id: 'prod-5', name: '商品E', sku: 'SKU005', category: '分类3', unit: '件', basePrice: 499.99, description: '商品E描述' }
    ];

    for (const product of products) {
      await db.Product.findOrCreate({
        where: { sku: product.sku },
        defaults: product
      });
    }
    console.log('商品数据已初始化');

    const inventoryItems = [
      { storeId: 'store-1', productId: 'prod-1', quantity: 100, price: 99.99, minStock: 20, maxStock: 200 },
      { storeId: 'store-1', productId: 'prod-2', quantity: 50, price: 199.99, minStock: 10, maxStock: 100 },
      { storeId: 'store-1', productId: 'prod-3', quantity: 15, price: 299.99, minStock: 20, maxStock: 100 },
      { storeId: 'store-2', productId: 'prod-1', quantity: 80, price: 109.99, minStock: 20, maxStock: 200 },
      { storeId: 'store-2', productId: 'prod-4', quantity: 30, price: 399.99, minStock: 10, maxStock: 100 },
      { storeId: 'store-3', productId: 'prod-2', quantity: 60, price: 209.99, minStock: 15, maxStock: 100 },
      { storeId: 'store-3', productId: 'prod-5', quantity: 5, price: 499.99, minStock: 10, maxStock: 50 }
    ];

    for (const item of inventoryItems) {
      const [inventory, created] = await db.Inventory.findOrCreate({
        where: { storeId: item.storeId, productId: item.productId },
        defaults: {
          ...item,
          id: uuidv4(),
          version: 0,
          lastUpdatedAt: new Date()
        }
      });

      if (created) {
        await db.InventorySnapshot.create({
          id: uuidv4(),
          inventoryId: inventory.id,
          quantity: item.quantity,
          price: item.price,
          version: 0,
          snapshotAt: new Date()
        });
      }
    }
    console.log('库存数据已初始化');

    console.log('\n数据初始化完成!');
    console.log('默认账号: admin / admin123');
    console.log('启动命令: npm run dev');

  } catch (error) {
    console.error('初始化数据失败:', error);
    process.exit(1);
  }
}

module.exports = initData;

if (require.main === module) {
  initData().then(() => {
    process.exit(0);
  });
}
