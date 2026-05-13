const db = require('./server/database');
const moment = require('moment');

const batches = [
  { batch_no: '20240501-001', consumable_name: '一次性注射器', manufacturer: 'A公司', production_date: moment().subtract(30, 'days').format('YYYY-MM-DD'), expiry_date: moment().add(365, 'days').format('YYYY-MM-DD'), quantity: 1000 },
  { batch_no: '20240501-002', consumable_name: '医用棉签', manufacturer: 'B公司', production_date: moment().subtract(60, 'days').format('YYYY-MM-DD'), expiry_date: moment().add(5, 'days').format('YYYY-MM-DD'), quantity: 5000 },
  { batch_no: '20240501-003', consumable_name: '医用口罩', manufacturer: 'C公司', production_date: moment().subtract(15, 'days').format('YYYY-MM-DD'), expiry_date: moment().add(180, 'days').format('YYYY-MM-DD'), quantity: 2000 }
];

const departments = ['内科', '外科', '儿科', '急诊科', '检验科'];

console.log('开始初始化数据...');

db.serialize(() => {
  const batchIds = [];
  
  batches.forEach(batch => {
    const stmt = db.prepare(`INSERT INTO consumable_batches (batch_no, consumable_name, manufacturer, production_date, expiry_date, quantity) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(batch.batch_no, batch.consumable_name, batch.manufacturer, batch.production_date, batch.expiry_date, batch.quantity, function(err) {
      if (err) console.error('创建批号失败:', err);
      else {
        console.log(`✓ 创建批号: ${batch.batch_no} (ID: ${this.lastID})`);
        batchIds.push(this.lastID);
        
        departments.forEach(dept => {
          const qty = Math.floor(Math.random() * 80) + 20;
          db.run(
            `INSERT INTO department_usages (batch_id, department_name, quantity, usage_date, operator) VALUES (?, ?, ?, ?, ?)`,
            [this.lastID, dept, qty, moment().format('YYYY-MM-DD'), 'admin'],
            function(err) {
              if (err) console.error('创建领用失败:', err);
              else console.log(`  - ${dept}: 领用 ${qty} 个`);
            }
          );
        });
      }
    });
    stmt.finalize();
  });
  
  console.log('\n数据初始化完成！');
  console.log('\n提示:');
  console.log('- 批号 20240501-001 有效期较远，可用于正常流程测试');
  console.log('- 批号 20240501-002 即将过期（5天），可用于测试拦截场景');
  console.log('- 每个批号都有5个科室的领用记录');
});
