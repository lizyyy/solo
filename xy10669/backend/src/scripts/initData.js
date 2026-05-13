const { runInsert, initializeDatabase } = require('../database');

async function initData() {
  await initializeDatabase();
  
  const items = [
    { name: '血常规', description: '血液常规检查', price: 50, category: '检验' },
    { name: '尿常规', description: '尿液常规检查', price: 30, category: '检验' },
    { name: '肝功能', description: '肝功能检查', price: 150, category: '检验' },
    { name: '肾功能', description: '肾功能检查', price: 100, category: '检验' },
    { name: '心电图', description: '心电图检查', price: 80, category: '检查' },
    { name: '胸片', description: '胸部X光', price: 120, category: '影像' },
    { name: 'CT胸部', description: '胸部CT', price: 500, category: '影像' },
    { name: '彩超腹部', description: '腹部彩超', price: 200, category: '影像' },
    { name: '肿瘤标志物', description: '肿瘤标志物筛查', price: 300, category: '检验' }
  ];

  const itemIds = [];
  for (const item of items) {
    const id = await runInsert(
      'INSERT INTO items (name, description, price, category) VALUES (?, ?, ?, ?)',
      [item.name, item.description, item.price, item.category]
    );
    itemIds.push(id);
    console.log(`创建项目: ${item.name} (ID: ${id})`);
  }

  await runInsert(
    'INSERT INTO item_exclusions (item1_id, item2_id, reason) VALUES (?, ?, ?)',
    [itemIds[2], itemIds[3], '孕妇禁用']
  );
  console.log('创建项目互斥: 肝功能 <-> 肾功能');

  const packages = [
    { name: '基础体检套餐', description: '基础健康检查', price: 200, items: [0, 1] },
    { name: '标准体检套餐', description: '标准健康检查', price: 500, items: [0, 1, 2, 3, 4] },
    { name: '豪华体检套餐', description: '全面健康检查', price: 1200, items: [0, 1, 2, 3, 4, 5, 7, 8] }
  ];

  for (const pkg of packages) {
    const packageId = await runInsert(
      'INSERT INTO packages (name, description, price) VALUES (?, ?, ?)',
      [pkg.name, pkg.description, pkg.price]
    );
    for (const itemIndex of pkg.items) {
      await runInsert(
        'INSERT INTO package_items (package_id, item_id) VALUES (?, ?)',
        [packageId, itemIds[itemIndex]]
      );
    }
    console.log(`创建套餐: ${pkg.name} (ID: ${packageId})`);
  }

  const appointments = [
    { userName: '张三', userPhone: '13800138001', packageId: 1, date: '2024-01-15', time: '09:00' },
    { userName: '李四', userPhone: '13800138002', packageId: 2, date: '2024-01-15', time: '10:00' },
    { userName: '王五', userPhone: '13800138003', packageId: 3, date: '2024-01-16', time: '08:30' }
  ];

  for (const apt of appointments) {
    const aptId = await runInsert(
      'INSERT INTO appointments (user_name, user_phone, package_id, appointment_date, appointment_time, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [apt.userName, apt.userPhone, apt.packageId, apt.date, apt.time, 'admin', 'scheduled']
    );
    console.log(`创建预约: ${apt.userName} (ID: ${aptId})`);
  }

  await runInsert(
    'INSERT INTO addon_orders (appointment_id, item_id, quantity, price, created_by, status) VALUES (?, ?, ?, ?, ?, ?)',
    [1, itemIds[4], 1, 80, 'admin', 'confirmed']
  );
  console.log('创建加项订单: 张三 - 心电图');

  await runInsert(
    'INSERT INTO waivers (appointment_id, item_id, reason, reason_type, handled_by, status) VALUES (?, ?, ?, ?, ?, ?)',
    [2, itemIds[2], '用户过敏', '医疗原因', '医生A', 'approved']
  );
  console.log('创建弃检: 李四 - 肝功能');

  console.log('数据初始化完成！');
  process.exit(0);
}

initData().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
