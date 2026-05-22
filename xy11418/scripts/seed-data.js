const { initDatabase } = require('../src/db/init');
const dbHelper = require('../src/utils/db-helper');
const { v4: uuidv4 } = require('uuid');

const residents = [
  { id: 'R001', name: '张三', room: '1栋101室' },
  { id: 'R002', name: '李四', room: '2栋305室' },
  { id: 'R003', name: '王五', room: '3栋202室' },
  { id: 'R004', name: '赵六', room: '1栋508室' },
  { id: 'R005', name: '钱七', room: '2栋101室' }
];

const repairmen = [
  { id: 'W001', name: '李师傅' },
  { id: 'W002', name: '王师傅' },
  { id: 'W003', name: '张师傅' }
];

const materials = [
  { code: 'M001', name: '水龙头', price: 85 },
  { code: 'M002', name: '灯泡', price: 25 },
  { code: 'M003', name: '水管接头', price: 15 },
  { code: 'M004', name: '密封条', price: 35 },
  { code: 'M005', name: '开关面板', price: 45 }
];

const repairTypes = ['水电维修', '门窗维修', '家电维修', '管道疏通', '墙面修补'];

function randomDate(baseDate, daysOffset) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + daysOffset + Math.random() * 2);
  date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
  return date.toISOString();
}

async function seedData() {
  console.log('开始生成测试数据...\n');

  const baseDate = new Date('2024-01-01');
  const createdOrders = [];

  console.log('=== 生成报修单 ===');
  for (let i = 0; i < 8; i++) {
    const resident = residents[i % residents.length];
    const orderNo = 'ORD-' + uuidv4().substr(0, 8).toUpperCase();
    const repairType = repairTypes[i % repairTypes.length];
    const reportTime = randomDate(baseDate, i * 3);

    let residentName = resident.name;
    let roomNo = resident.room;
    let finalRepairType = repairType;

    if (i === 2) {
      residentName = null;
      console.log(`  ${orderNo}: 缺字段 - 住户姓名`);
    }
    if (i === 5) {
      roomNo = null;
      finalRepairType = null;
      console.log(`  ${orderNo}: 缺字段 - 房间号、报修类型`);
    }

    const sql = `
      INSERT INTO repair_orders 
      (order_no, resident_id, resident_name, room_no, repair_type, description, screenshot_url, report_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      orderNo,
      resident.id,
      residentName,
      roomNo,
      finalRepairType,
      `${repairType}报修`,
      `/screenshots/${orderNo}.jpg`,
      reportTime,
      'completed'
    ]);

    createdOrders.push({ orderNo, reportTime, hasDirty: i === 2 || i === 5 });
    console.log(`  创建报修单: ${orderNo} - ${resident.name || '未知'} - ${repairType}`);
  }

  console.log('\n=== 生成维修回执 ===');
  for (let i = 0; i < createdOrders.length; i++) {
    const order = createdOrders[i];
    const repairman = repairmen[i % repairmen.length];
    const reportDate = new Date(order.reportTime);

    const receiptCount = i === 1 || i === 3 ? 2 : 1;

    for (let j = 0; j < receiptCount; j++) {
      const receiptNo = 'RCT-' + uuidv4().substr(0, 8).toUpperCase();
      const isRework = j === 1;
      const isPartReplacement = i % 2 === 0;

      let arrivalTime = randomDate(reportDate, 1);
      let completeTime = randomDate(new Date(arrivalTime), 0);

      if (i === 4 && j === 0) {
        const temp = arrivalTime;
        arrivalTime = completeTime;
        completeTime = temp;
        console.log(`  ${receiptNo}: 跨日异常 - 完成时间早于到达时间`);
      }

      let repairmanName = repairman.name;
      if (i === 6) {
        repairmanName = null;
        console.log(`  ${receiptNo}: 缺字段 - 维修师傅姓名`);
      }

      const sql = `
        INSERT INTO repair_receipts
        (receipt_no, order_no, repairman_id, repairman_name, arrival_time, complete_time,
         repair_content, is_rework, is_part_replacement, receipt_image_url, labor_fee, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await dbHelper.run(sql, [
        receiptNo,
        order.orderNo,
        repairman.id,
        repairmanName,
        arrivalTime,
        completeTime,
        isRework ? '返修处理' : '常规维修',
        isRework ? 1 : 0,
        isPartReplacement ? 1 : 0,
        `/receipts/${receiptNo}.jpg`,
        80 + Math.floor(Math.random() * 100),
        'completed'
      ]);

      console.log(`  创建回执: ${receiptNo} ${isRework ? '(返修)' : ''} ${isPartReplacement ? '(换件)' : ''} - ${order.orderNo}`);
    }
  }

  console.log('\n=== 生成材料领用 ===');
  for (let i = 0; i < createdOrders.length; i++) {
    const order = createdOrders[i];

    if (i % 2 === 0) {
      const material = materials[i % materials.length];
      const usageNo = 'MAT-' + uuidv4().substr(0, 8).toUpperCase();
      const quantity = 1 + Math.floor(Math.random() * 3);
      const unitPrice = material.price;

      let totalPrice = quantity * unitPrice;
      let materialName = material.name;

      if (i === 0) {
        totalPrice = totalPrice + 20;
        console.log(`  ${usageNo}: 金额冲突 - 总价计算不符`);
      }
      if (i === 2) {
        materialName = null;
        console.log(`  ${usageNo}: 缺字段 - 材料名称`);
      }

      const sql = `
        INSERT INTO material_usages
        (usage_no, order_no, material_code, material_name, quantity, unit_price, total_price, receiver, receive_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await dbHelper.run(sql, [
        usageNo,
        order.orderNo,
        material.code,
        materialName,
        quantity,
        unitPrice,
        totalPrice,
        repairmen[i % repairmen.length].name,
        randomDate(new Date(order.reportTime), 1)
      ]);

      console.log(`  材料领用: ${usageNo} - ${material.name || '未知'} x${quantity} - ${order.orderNo}`);
    }
  }

  console.log('\n=== 生成退款流水 ===');
  for (let i = 0; i < 3; i++) {
    const order = createdOrders[i + 2];
    const transNo = 'REF-' + uuidv4().substr(0, 8).toUpperCase();

    let refundAmount = 30 + Math.floor(Math.random() * 50);
    if (i === 0) {
      refundAmount = -10;
      console.log(`  ${transNo}: 异常 - 退款金额为负数`);
    }

    const sql = `
      INSERT INTO refund_transactions
      (trans_no, order_no, refund_amount, refund_reason, trans_time, operator, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await dbHelper.run(sql, [
      transNo,
      order.orderNo,
      refundAmount,
      i === 1 ? '服务不满意退款' : '重复收费退款',
      randomDate(new Date(order.reportTime), 5),
      '管理员',
      'completed'
    ]);

    console.log(`  退款流水: ${transNo} - ${refundAmount}元 - ${order.orderNo}`);
  }

  console.log('\n=== 手动插入脏记录 ===');
  const dirtyRecords = [
    {
      source_type: 'repair_order',
      source_id: createdOrders[2].orderNo,
      raw_content: JSON.stringify({ order_no: createdOrders[2].orderNo, resident_name: null }),
      dirty_type: 'missing_field',
      field_name: 'resident_name',
      error_message: '报修单缺少住户姓名字段',
      suggestion: '请补充住户姓名信息'
    },
    {
      source_type: 'material',
      source_id: 'MAT-' + uuidv4().substr(0, 8).toUpperCase(),
      raw_content: JSON.stringify({ material_name: '水龙头', quantity: 2, total_price: 150 }),
      dirty_type: 'amount_conflict',
      field_name: 'total_price',
      error_message: '总价与数量×单价不符',
      suggestion: '请核实材料总价'
    }
  ];

  for (const dirty of dirtyRecords) {
    await dbHelper.run(
      `INSERT INTO dirty_records 
       (source_type, source_id, raw_content, dirty_type, field_name, error_message, suggestion, is_resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [dirty.source_type, dirty.source_id, dirty.raw_content, dirty.dirty_type, dirty.field_name, dirty.error_message, dirty.suggestion]
    );
    console.log(`  脏记录: ${dirty.dirty_type} - ${dirty.field_name}`);
  }

  console.log('\n=== 数据生成完成 ===');
  console.log(`  报修单: ${createdOrders.length} 条`);
  console.log(`  其中含脏数据: ${createdOrders.filter(o => o.hasDirty).length} 条`);

  return createdOrders.map(o => o.orderNo);
}

async function main() {
  try {
    await initDatabase();
    await dbHelper.connect();
    const orderNos = await seedData();
    await dbHelper.close();

    console.log('\n生成的报修单号供测试使用:');
    orderNos.forEach((no, i) => console.log(`  ${i + 1}. ${no}`));
    console.log('\n造数完成！可以启动服务进行测试。');
  } catch (err) {
    console.error('造数失败:', err);
    process.exit(1);
  }
}

main();
