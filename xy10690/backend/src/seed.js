const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const consultants = [
  { id: 'cons-001', name: '张美容', phone: '13800000001' },
  { id: 'cons-002', name: '李化妆', phone: '13800000002' },
  { id: 'cons-003', name: '王造型', phone: '13800000003' }
];

const products = [
  { id: 'prod-001', name: '水润粉底液', brand: '雅诗兰黛', category: '底妆', ingredients: '水,甘油,二氧化钛,氧化铁', stock: 100 },
  { id: 'prod-002', name: '持妆口红', brand: 'MAC', category: '唇妆', ingredients: '蓖麻油,蜂蜡,香料,酒精', stock: 50 },
  { id: 'prod-003', name: '防晒隔离霜', brand: '兰蔻', category: '隔离', ingredients: '氧化锌,二氧化钛,甘油', stock: 80 },
  { id: 'prod-004', name: '眼影盘', brand: 'Tom Ford', category: '眼妆', ingredients: '滑石粉,云母,氧化铁', stock: 30 }
];

const customers = [
  { id: 'cust-001', name: '陈小姐', phone: '13900000001', allergyHistory: [] },
  { id: 'cust-002', name: '周女士', phone: '13900000002', allergyHistory: [{ allergen: '酒精', severity: '严重' }] },
  { id: 'cust-003', name: '吴太太', phone: '13900000003', allergyHistory: [{ allergen: '香料', severity: '轻微' }] },
  { id: 'cust-004', name: '郑女士', phone: '13900000004', allergyHistory: [] }
];

const today = moment().format('YYYY-MM-DD');
const schedules = [
  { id: 'sched-001', consultantId: 'cons-001', date: today, shift: '早班' },
  { id: 'sched-002', consultantId: 'cons-002', date: today, shift: '中班' },
  { id: 'sched-003', consultantId: 'cons-003', date: today, shift: '晚班' },
  { id: 'sched-004', consultantId: 'cons-001', date: moment().add(1, 'days').format('YYYY-MM-DD'), shift: '早班' }
];

function seedData() {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('开始事务失败:', err);
        return;
      }

      let completed = 0;
      const total = consultants.length + products.length + customers.length + schedules.length;

      consultants.forEach(cons => {
        db.run(
          'INSERT OR IGNORE INTO consultants (id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [cons.id, cons.name, cons.phone, moment().toISOString(), moment().toISOString()],
          (err) => {
            if (err) console.error('插入顾问失败:', err);
            checkComplete();
          }
        );
      });

      products.forEach(prod => {
        db.run(
          'INSERT OR IGNORE INTO products (id, name, brand, category, ingredients, stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [prod.id, prod.name, prod.brand, prod.category, prod.ingredients, prod.stock, moment().toISOString(), moment().toISOString()],
          (err) => {
            if (err) console.error('插入产品失败:', err);
            checkComplete();
          }
        );
      });

      customers.forEach(cust => {
        db.run(
          'INSERT OR IGNORE INTO customers (id, name, phone, allergy_history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [cust.id, cust.name, cust.phone, JSON.stringify(cust.allergyHistory), moment().toISOString(), moment().toISOString()],
          (err) => {
            if (err) console.error('插入客户失败:', err);
            checkComplete();
          }
        );
      });

      schedules.forEach(sched => {
        db.run(
          'INSERT OR IGNORE INTO schedules (id, consultant_id, date, shift, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [sched.id, sched.consultantId, sched.date, sched.shift, 'active', moment().toISOString(), moment().toISOString()],
          (err) => {
            if (err) console.error('插入排班失败:', err);
            checkComplete();
          }
        );
      });

      function checkComplete() {
        completed++;
        if (completed >= 4) {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('提交事务失败:', err);
            } else {
              console.log('✅ 测试数据已成功插入!');
              console.log('📊 数据统计:');
              console.log(`   顾问: ${consultants.length} 人`);
              console.log(`   产品: ${products.length} 个`);
              console.log(`   客户: ${customers.length} 人`);
              console.log(`   排班: ${schedules.length} 条`);
              console.log('');
              console.log('🎯 演示场景说明:');
              console.log('   成功路径: 陈小姐 + 张美容 + 水润粉底液');
              console.log('   拦截路径: 周女士(酒精过敏) + 张美容 + 持妆口红(含酒精)');
              console.log('   人工修正: 拦截后人工通过');
              console.log('   重复提交: 相同requestId触发幂等性');
            }
            process.exit(0);
          });
        }
      }
    });
  });
}

seedData();
