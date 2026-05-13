const db = require('./database');

const initData = async () => {
  console.log('开始初始化数据...');

  const giftTypes = ['商务礼品', '节日礼品', '纪念礼品', '促销礼品'];
  const suppliers = ['礼品公司A', '礼品公司B', '礼品公司C'];
  const departments = ['销售部', '市场部', '人事部', '技术部', '财务部'];
  const employees = ['张三', '李四', '王五', '赵六', '钱七'];
  const statuses = ['pending', 'approved', 'rejected', 'completed'];
  const expressCompanies = ['顺丰', '圆通', '中通', '韵达', 'EMS'];

  for (let i = 1; i <= 10; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO gift_inventory (gift_name, gift_type, quantity, unit, unit_price, supplier, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `礼品${i}`,
          giftTypes[Math.floor(Math.random() * giftTypes.length)],
          Math.floor(Math.random() * 100) + 10,
          '件',
          Math.floor(Math.random() * 500) + 50,
          suppliers[Math.floor(Math.random() * suppliers.length)],
          `这是礼品${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('礼品库存数据初始化完成');

  for (let i = 1; i <= 5; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO activity_plans (plan_name, start_date, end_date, gift_type, total_quantity, budget, responsible_person, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `活动计划${i}`,
          '2024-01-01',
          '2024-12-31',
          giftTypes[Math.floor(Math.random() * giftTypes.length)],
          Math.floor(Math.random() * 500) + 50,
          Math.floor(Math.random() * 50000) + 5000,
          employees[Math.floor(Math.random() * employees.length)],
          statuses[Math.floor(Math.random() * statuses.length)],
          `这是活动计划${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('活动计划数据初始化完成');

  for (let i = 1; i <= 20; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO customer_lists (plan_id, customer_name, phone, address, gift_type, gift_quantity, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Math.floor(Math.random() * 5) + 1,
          `客户${i}`,
          `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
          `北京市朝阳区某某街道${i}号`,
          giftTypes[Math.floor(Math.random() * giftTypes.length)],
          Math.floor(Math.random() * 10) + 1,
          statuses[Math.floor(Math.random() * statuses.length)],
          `这是客户${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('客户名单数据初始化完成');

  for (let i = 1; i <= 15; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO employee_claims (employee_name, department, gift_type, quantity, claim_date, purpose, approver, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employees[Math.floor(Math.random() * employees.length)],
          departments[Math.floor(Math.random() * departments.length)],
          giftTypes[Math.floor(Math.random() * giftTypes.length)],
          Math.floor(Math.random() * 5) + 1,
          '2024-01-15',
          '客户拜访',
          employees[Math.floor(Math.random() * employees.length)],
          statuses[Math.floor(Math.random() * statuses.length)],
          `这是领用记录${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('员工领用数据初始化完成');

  for (let i = 1; i <= 15; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO express_orders (customer_id, tracking_number, express_company, sender, send_date, receive_date, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Math.floor(Math.random() * 20) + 1,
          `SF${Math.floor(Math.random() * 10000000000)}`,
          expressCompanies[Math.floor(Math.random() * expressCompanies.length)],
          employees[Math.floor(Math.random() * employees.length)],
          '2024-01-10',
          '2024-01-12',
          statuses[Math.floor(Math.random() * statuses.length)],
          `这是快递${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('快递单号数据初始化完成');

  const returnReasons = ['客户拒收', '地址错误', '礼品损坏', '其他'];
  const sourceTypes = ['customer', 'employee'];
  
  for (let i = 1; i <= 8; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO return_inventory (gift_type, quantity, return_reason, return_date, handler, source_type, source_id, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          giftTypes[Math.floor(Math.random() * giftTypes.length)],
          Math.floor(Math.random() * 3) + 1,
          returnReasons[Math.floor(Math.random() * returnReasons.length)],
          '2024-01-20',
          employees[Math.floor(Math.random() * employees.length)],
          sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
          Math.floor(Math.random() * 10) + 1,
          `这是退回记录${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('退回入库数据初始化完成');

  const exceptionTypes = ['库存异常', '计划异常', '客户异常', '领用异常', '快递异常'];
  const modules = ['inventory', 'plans', 'customers', 'claims', 'express'];
  
  for (let i = 1; i <= 6; i++) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO exception_records (exception_type, related_module, related_id, reason, before_value, after_value, handler, handle_time, status, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exceptionTypes[Math.floor(Math.random() * exceptionTypes.length)],
          modules[Math.floor(Math.random() * modules.length)],
          Math.floor(Math.random() * 10) + 1,
          `异常原因${i}：数据不一致需要处理`,
          '100',
          '150',
          employees[Math.floor(Math.random() * employees.length)],
          '2024-01-25 10:00:00',
          i % 2 === 0 ? 'resolved' : 'pending',
          `这是异常记录${i}的备注信息`
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('异常记录数据初始化完成');

  console.log('所有数据初始化完成！');
  process.exit(0);
};

initData().catch(err => {
  console.error('初始化数据失败:', err);
  process.exit(1);
});
