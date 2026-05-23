import { db } from '../database/db';
import { initDatabase } from '../database/init';

const sampleData = async () => {
  console.log('开始初始化样例数据...\n');

  const customers = [
    { name: '张三废品站', phone: '13800138001', address: '北京市朝阳区废品市场A区' },
    { name: '李四回收站', phone: '13800138002', address: '北京市海淀区环保产业园' },
    { name: '王五回收点', phone: '13800138003', address: '北京市丰台区回收中心' }
  ];

  for (const customer of customers) {
    await new Promise((resolve) => {
      db.run(`INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`,
        [customer.name, customer.phone, customer.address],
        function (err) {
          if (err) console.error(err);
          else console.log(`✓ 创建客户: ${customer.name}`);
          resolve(this.lastID);
        }
      );
    });
  }

  const categories = [
    { name: '废铁', code: 'FE001', description: '黑色金属废料' },
    { name: '废铝', code: 'AL001', description: '有色金属废料' },
    { name: '废铜', code: 'CU001', description: '有色金属废料' },
    { name: '废纸', code: 'PA001', description: '纸类回收' },
    { name: '废塑料', code: 'PL001', description: '塑料回收' }
  ];

  const categoryIds: number[] = [];
  for (const category of categories) {
    await new Promise((resolve) => {
      db.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
        [category.name, category.code, category.description],
        function (err) {
          if (err) console.error(err);
          else {
            console.log(`✓ 创建品类: ${category.name}`);
            categoryIds.push(this.lastID as number);
          }
          resolve(this.lastID);
        }
      );
    });
  }

  const prices = [
    { categoryId: 1, price: 2.5, version: 1 },
    { categoryId: 2, price: 12.0, version: 1 },
    { categoryId: 3, price: 45.0, version: 1 },
    { categoryId: 4, price: 1.2, version: 1 },
    { categoryId: 5, price: 0.8, version: 1 }
  ];

  const today = new Date().toISOString().split('T')[0];
  for (const price of prices) {
    await new Promise((resolve) => {
      db.run(`INSERT INTO price_versions (category_id, price, effective_date, version) VALUES (?, ?, ?, ?)`,
        [price.categoryId, price.price, today, price.version],
        function (err) {
          if (err) console.error(err);
          else console.log(`✓ 创建价格版本: 品类${price.categoryId} - ${price.price}元/kg`);
          resolve(this.lastID);
        }
      );
    });
  }

  const deductions = [
    { categoryId: 1, ratio: 0.02, description: '正常杂质扣减' },
    { categoryId: 2, ratio: 0.01, description: '正常杂质扣减' },
    { categoryId: 3, ratio: 0.005, description: '正常杂质扣减' },
    { categoryId: 4, ratio: 0.03, description: '正常杂质扣减' },
    { categoryId: 5, ratio: 0.025, description: '正常杂质扣减' }
  ];

  for (const deduction of deductions) {
    await new Promise((resolve) => {
      db.run(`INSERT INTO deduction_ratios (category_id, ratio, description) VALUES (?, ?, ?)`,
        [deduction.categoryId, deduction.ratio, deduction.description],
        function (err) {
          if (err) console.error(err);
          else console.log(`✓ 创建扣杂比例: 品类${deduction.categoryId} - ${deduction.ratio * 100}%`);
          resolve(this.lastID);
        }
      );
    });
  }

  console.log('\n========================================');
  console.log('  样例数据初始化完成！');
  console.log('  - 3个客户');
  console.log('  - 5个品类');
  console.log('  - 5套价格版本');
  console.log('  - 5个扣杂比例规则');
  console.log('========================================\n');

  process.exit(0);
};

initDatabase().then(() => {
  sampleData();
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
