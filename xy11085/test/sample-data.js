const db = require('../src/database');
const QuoteLockService = require('../src/services/quoteLockService');

async function insertSampleData() {
  console.log('开始插入样例数据...\n');

  const sampleData = [
    {
      customer_id: 'C001', customer_name: '东方印务有限公司',
      store_id: 'S001', store_name: '中心门店',
      product_type: '宣传单', paper_type: '铜版纸', paper_size: 'A4',
      width: 210, height: 297, quantity: 5000,
      color_mode: '四色', double_sided: true,
      locked_price: 1200.00, status: 'approved',
      responsible_person: '张三', lock_date: '2024-01-15',
      valid_from: '2024-01-15', valid_to: '2024-06-30',
      review_conclusion: '价格合理'
    },
    {
      customer_id: 'C002', customer_name: '南方广告公司',
      store_id: 'S002', store_name: '东门店',
      product_type: '画册', paper_type: '哑粉纸', paper_size: 'A3',
      width: 297, height: 420, quantity: 1000,
      color_mode: '四色', double_sided: true,
      locked_price: 3500.00, status: 'pending',
      responsible_person: '李四', lock_date: '2024-01-16',
      valid_from: '2024-01-16', valid_to: '2024-12-31'
    },
    {
      customer_id: 'C003', customer_name: '西城设计工作室',
      store_id: 'S001', store_name: '中心门店',
      product_type: '名片', paper_type: '铜版纸', paper_size: 'A4',
      width: 210, height: 297, quantity: 2000,
      color_mode: '单色', double_sided: false,
      locked_price: 300.00, status: 'reviewing',
      responsible_person: '王五', lock_date: '2024-01-17',
      valid_from: '2024-01-17', valid_to: '2024-03-31'
    }
  ];

  for (const data of sampleData) {
    try {
      const result = await QuoteLockService.create(data, 'system');
      console.log(`✓ 已创建: ${result.quote_no} - ${data.customer_name}`);
      console.log(`  原始报价: ${result.original_price}, 锁定价格: ${data.locked_price}, 折扣率: ${result.discount_rate}%\n`);
    } catch (error) {
      console.error(`✗ 创建失败: ${error.message}`);
    }
  }

  console.log('样例数据插入完成！');
  console.log('\n测试查询功能...');
  
  const allRecords = await QuoteLockService.query();
  console.log(`总记录数: ${allRecords.length}`);

  const zhangsanRecords = await QuoteLockService.query({ responsible_person: '张三' });
  console.log(`张三负责的记录数: ${zhangsanRecords.length}`);

  process.exit(0);
}

insertSampleData();
