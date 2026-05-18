const { run, get, all } = require('./database');

async function seedData() {
  console.log('=== 开始植入种子数据 ===\n');

  const students = [
    { student_no: '20240101', name: '张小明', grade: '三年级', class_name: '1班', gender: '男' },
    { student_no: '20240102', name: '李小红', grade: '三年级', class_name: '1班', gender: '女' },
    { student_no: '20240203', name: '王小刚', grade: '三年级', class_name: '2班', gender: '男' },
    { student_no: '20240204', name: '赵小芳', grade: '三年级', class_name: '2班', gender: '女' },
  ];

  for (const s of students) {
    const exists = await get('SELECT id FROM students WHERE student_no = ?', [s.student_no]);
    if (!exists) {
      await run(
        'INSERT INTO students (student_no, name, grade, class_name, gender) VALUES (?, ?, ?, ?, ?)',
        [s.student_no, s.name, s.grade, s.class_name, s.gender]
      );
    }
  }
  console.log('✓ 学生数据已植入:', students.length, '人');

  const products = [
    { product_code: 'U-CS-S-001', name: '夏季短袖上衣', season: '夏季', type: '上衣', base_price: 68.00 },
    { product_code: 'U-CS-P-001', name: '夏季短裤', season: '夏季', type: '下装', base_price: 45.00 },
    { product_code: 'U-AW-J-001', name: '秋季运动外套', season: '秋季', type: '外套', base_price: 128.00 },
    { product_code: 'U-AW-P-001', name: '秋季长裤', season: '秋季', type: '下装', base_price: 78.00 },
  ];

  for (const p of products) {
    const exists = await get('SELECT id FROM uniform_products WHERE product_code = ?', [p.product_code]);
    if (!exists) {
      await run(
        'INSERT INTO uniform_products (product_code, name, season, type, base_price) VALUES (?, ?, ?, ?, ?)',
        [p.product_code, p.name, p.season, p.type, p.base_price]
      );
    }
  }
  console.log('✓ 校服产品数据已植入:', products.length, '款');

  const productIds = await all('SELECT id, product_code FROM uniform_products');
  const productIdMap = {};
  productIds.forEach(p => productIdMap[p.product_code] = p.id);

  const sizes = [
    { product_code: 'U-CS-S-001', size_code: '120', size_name: '120码', suggested_height: '115-125cm', suggested_weight: '20-25kg' },
    { product_code: 'U-CS-S-001', size_code: '130', size_name: '130码', suggested_height: '125-135cm', suggested_weight: '25-30kg' },
    { product_code: 'U-CS-S-001', size_code: '140', size_name: '140码', suggested_height: '135-145cm', suggested_weight: '30-35kg' },
    { product_code: 'U-CS-S-001', size_code: '150', size_name: '150码', suggested_height: '145-155cm', suggested_weight: '35-42kg' },
    { product_code: 'U-CS-P-001', size_code: '120', size_name: '120码', suggested_height: '115-125cm', suggested_weight: '20-25kg' },
    { product_code: 'U-CS-P-001', size_code: '130', size_name: '130码', suggested_height: '125-135cm', suggested_weight: '25-30kg' },
    { product_code: 'U-CS-P-001', size_code: '140', size_name: '140码', suggested_height: '135-145cm', suggested_weight: '30-35kg' },
    { product_code: 'U-CS-P-001', size_code: '150', size_name: '150码', suggested_height: '145-155cm', suggested_weight: '35-42kg' },
    { product_code: 'U-AW-J-001', size_code: '130', size_name: '130码', suggested_height: '125-135cm', suggested_weight: '25-30kg' },
    { product_code: 'U-AW-J-001', size_code: '140', size_name: '140码', suggested_height: '135-145cm', suggested_weight: '30-35kg' },
    { product_code: 'U-AW-J-001', size_code: '150', size_name: '150码', suggested_height: '145-155cm', suggested_weight: '35-42kg' },
    { product_code: 'U-AW-P-001', size_code: '130', size_name: '130码', suggested_height: '125-135cm', suggested_weight: '25-30kg' },
    { product_code: 'U-AW-P-001', size_code: '140', size_name: '140码', suggested_height: '135-145cm', suggested_weight: '30-35kg' },
    { product_code: 'U-AW-P-001', size_code: '150', size_name: '150码', suggested_height: '145-155cm', suggested_weight: '35-42kg' },
  ];

  for (const s of sizes) {
    const exists = await get('SELECT id FROM uniform_sizes WHERE product_id = ? AND size_code = ?', 
      [productIdMap[s.product_code], s.size_code]);
    if (!exists) {
      await run(
        'INSERT INTO uniform_sizes (product_id, size_code, size_name, suggested_height, suggested_weight) VALUES (?, ?, ?, ?, ?)',
        [productIdMap[s.product_code], s.size_code, s.size_name, s.suggested_height, s.suggested_weight]
      );
    }
  }
  console.log('✓ 尺码数据已植入:', sizes.length, '个');

  const sizeIds = await all('SELECT id, product_id, size_code FROM uniform_sizes');
  const sizeIdMap = {};
  sizeIds.forEach(s => {
    const product = products.find(p => productIdMap[p.product_code] === s.product_id);
    if (product) {
      sizeIdMap[`${product.product_code}-${s.size_code}`] = s.id;
    }
  });

  const inventoryData = [
    { sizeKey: 'U-CS-S-001-120', quantity: 15, location: 'A区-01架' },
    { sizeKey: 'U-CS-S-001-130', quantity: 22, location: 'A区-01架' },
    { sizeKey: 'U-CS-S-001-140', quantity: 18, location: 'A区-01架' },
    { sizeKey: 'U-CS-S-001-150', quantity: 8, location: 'A区-01架' },
    { sizeKey: 'U-CS-P-001-120', quantity: 12, location: 'A区-02架' },
    { sizeKey: 'U-CS-P-001-130', quantity: 20, location: 'A区-02架' },
    { sizeKey: 'U-CS-P-001-140', quantity: 16, location: 'A区-02架' },
    { sizeKey: 'U-CS-P-001-150', quantity: 5, location: 'A区-02架' },
    { sizeKey: 'U-AW-J-001-130', quantity: 10, location: 'B区-01架' },
    { sizeKey: 'U-AW-J-001-140', quantity: 14, location: 'B区-01架' },
    { sizeKey: 'U-AW-J-001-150', quantity: 6, location: 'B区-01架' },
    { sizeKey: 'U-AW-P-001-130', quantity: 11, location: 'B区-02架' },
    { sizeKey: 'U-AW-P-001-140', quantity: 13, location: 'B区-02架' },
    { sizeKey: 'U-AW-P-001-150', quantity: 4, location: 'B区-02架' },
  ];

  for (const i of inventoryData) {
    const exists = await get('SELECT id FROM inventory WHERE size_id = ?', [sizeIdMap[i.sizeKey]]);
    if (!exists) {
      await run(
        'INSERT INTO inventory (size_id, quantity, location) VALUES (?, ?, ?)',
        [sizeIdMap[i.sizeKey], i.quantity, i.location]
      );
    }
  }
  console.log('✓ 库存数据已植入:', inventoryData.length, '条');

  const studentIds = await all('SELECT id, student_no FROM students');
  const studentIdMap = {};
  studentIds.forEach(s => studentIdMap[s.student_no] = s.id);

  const originalOrders = [
    { order_no: 'ORD202405001', student_no: '20240101', sizeKey: 'U-CS-S-001-130', quantity: 1, order_date: '2024-05-10', receive_date: '2024-05-15', status: '已领取' },
    { order_no: 'ORD202405002', student_no: '20240101', sizeKey: 'U-CS-P-001-130', quantity: 1, order_date: '2024-05-10', receive_date: '2024-05-15', status: '已领取' },
    { order_no: 'ORD202405003', student_no: '20240102', sizeKey: 'U-CS-S-001-120', quantity: 1, order_date: '2024-05-10', receive_date: '2024-05-15', status: '已领取' },
    { order_no: 'ORD202405004', student_no: '20240203', sizeKey: 'U-CS-S-001-140', quantity: 1, order_date: '2024-05-11', receive_date: '2024-05-16', status: '已领取' },
    { order_no: 'ORD202405005', student_no: '20240204', sizeKey: 'U-CS-S-001-130', quantity: 1, order_date: '2024-05-11', receive_date: '2024-05-16', status: '已领取' },
    { order_no: 'ORD202409001', student_no: '20240101', sizeKey: 'U-AW-J-001-140', quantity: 1, order_date: '2024-09-01', receive_date: '2024-09-05', status: '已领取' },
    { order_no: 'ORD202409002', student_no: '20240102', sizeKey: 'U-AW-J-001-130', quantity: 1, order_date: '2024-09-01', receive_date: '2024-09-05', status: '已领取' },
  ];

  for (const o of originalOrders) {
    const exists = await get('SELECT id FROM original_orders WHERE order_no = ?', [o.order_no]);
    if (!exists) {
      await run(
        'INSERT INTO original_orders (order_no, student_id, size_id, quantity, order_date, receive_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [o.order_no, studentIdMap[o.student_no], sizeIdMap[o.sizeKey], o.quantity, o.order_date, o.receive_date, o.status]
      );
    }
  }
  console.log('✓ 原始订单数据已植入:', originalOrders.length, '单');

  const orderIds = await all('SELECT id, order_no FROM original_orders');
  const orderIdMap = {};
  orderIds.forEach(o => orderIdMap[o.order_no] = o.id);

  const exchangeOrders = [
    {
      exchange_no: 'EXC2024051001',
      order_no: 'ORD202405001',
      student_no: '20240101',
      fromSizeKey: 'U-CS-S-001-130',
      toSizeKey: 'U-CS-S-001-140',
      reason: '尺码偏小',
      reason_detail: '穿着后手臂活动受限，胸前紧绷',
      contact_phone: '13800138001',
      status: '已完成',
      created_at: '2024-05-20 10:30:00'
    },
    {
      exchange_no: 'EXC2024052001',
      order_no: 'ORD202405003',
      student_no: '20240102',
      fromSizeKey: 'U-CS-S-001-120',
      toSizeKey: 'U-CS-S-001-130',
      reason: '尺码偏小',
      reason_detail: '孩子半年内长高了8厘米，原来的穿不下',
      contact_phone: '13800138002',
      status: '正常',
      created_at: '2024-05-25 14:20:00'
    },
    {
      exchange_no: 'EXC2024052501',
      order_no: 'ORD202405004',
      student_no: '20240203',
      fromSizeKey: 'U-CS-S-001-140',
      toSizeKey: 'U-CS-S-001-150',
      reason: '想换大码',
      reason_detail: '',
      contact_phone: '',
      status: '驳回',
      reject_reason: '换货原由描述不完整，且未留联系电话，请补录详细说明后重新提交',
      created_at: '2024-05-28 09:15:00'
    },
    {
      exchange_no: 'EXC2024052801',
      order_no: 'ORD202405005',
      student_no: '20240204',
      fromSizeKey: 'U-CS-S-001-130',
      toSizeKey: 'U-CS-S-001-140',
      reason: '尺码偏小',
      reason_detail: '',
      contact_phone: '',
      status: '补录',
      supplementary_notes: '请补充具体穿着不适的部位描述，并留下家长联系电话',
      created_at: '2024-05-29 16:45:00'
    },
    {
      exchange_no: 'EXC2024090801',
      order_no: 'ORD202409001',
      student_no: '20240101',
      fromSizeKey: 'U-AW-J-001-140',
      toSizeKey: 'U-AW-J-001-150',
      reason: '尺码偏小',
      reason_detail: '外套肩部偏窄，穿厚毛衣后拉不上拉链',
      contact_phone: '13800138001',
      status: '待审核',
      created_at: '2024-09-08 11:00:00'
    },
  ];

  for (const e of exchangeOrders) {
    const exists = await get('SELECT id FROM exchange_orders WHERE exchange_no = ?', [e.exchange_no]);
    if (!exists) {
      await run(
        `INSERT INTO exchange_orders 
        (exchange_no, original_order_id, student_id, from_size_id, to_size_id, reason, reason_detail, contact_phone, status, reject_reason, supplementary_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.exchange_no,
          orderIdMap[e.order_no],
          studentIdMap[e.student_no],
          sizeIdMap[e.fromSizeKey],
          sizeIdMap[e.toSizeKey],
          e.reason,
          e.reason_detail,
          e.contact_phone,
          e.status,
          e.reject_reason || null,
          e.supplementary_notes || null,
          e.created_at,
          e.created_at
        ]
      );
    }
  }
  console.log('✓ 换货单数据已植入:', exchangeOrders.length, '单');
  console.log('  - 已完成:', exchangeOrders.filter(e => e.status === '已完成').length, '单');
  console.log('  - 正常:', exchangeOrders.filter(e => e.status === '正常').length, '单');
  console.log('  - 驳回:', exchangeOrders.filter(e => e.status === '驳回').length, '单');
  console.log('  - 补录:', exchangeOrders.filter(e => e.status === '补录').length, '单');
  console.log('  - 待审核:', exchangeOrders.filter(e => e.status === '待审核').length, '单');

  console.log('\n=== 种子数据植入完成 ===');
}

if (require.main === module) {
  seedData().catch(console.error);
}

module.exports = { seedData };
