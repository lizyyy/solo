import db, { initDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

const seedData = async () => {
  await initDatabase();
  console.log('数据库初始化完成，开始导入种子数据...');

  const customers = [
    {
      customer_id: 'CUST001',
      name: '张伟',
      phone: '13800138001',
      id_card: '310101199001011234',
      credit_score: 85,
      total_rentals: 12,
      overdue_times: 2
    },
    {
      customer_id: 'CUST002',
      name: '李娜',
      phone: '13900139002',
      id_card: '310101199202022345',
      credit_score: 95,
      total_rentals: 8,
      overdue_times: 0
    },
    {
      customer_id: 'CUST003',
      name: '王强',
      phone: '13700137003',
      id_card: '310101198803033456',
      credit_score: 60,
      total_rentals: 5,
      overdue_times: 3
    }
  ];

  for (const customer of customers) {
    db.run(
      'INSERT OR REPLACE INTO customers (customer_id, name, phone, id_card, credit_score, total_rentals, overdue_times) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [customer.customer_id, customer.name, customer.phone, customer.id_card, customer.credit_score, customer.total_rentals, customer.overdue_times]
    );
  }

  const equipment = [
    {
      equipment_id: 'EQ001',
      type: 'camera_body',
      brand: 'Canon',
      model: 'EOS R5',
      serial_number: 'CNR5-2023-001234',
      purchase_price: 25999,
      daily_rental_price: 180,
      deposit: 5000,
      status: 'rented',
      condition: 'good'
    },
    {
      equipment_id: 'EQ002',
      type: 'lens',
      brand: 'Canon',
      model: 'RF 24-70mm f/2.8L IS USM',
      serial_number: 'CNRF2470-2023-005678',
      purchase_price: 16999,
      daily_rental_price: 120,
      deposit: 3000,
      status: 'rented',
      condition: 'good'
    },
    {
      equipment_id: 'EQ003',
      type: 'camera_body',
      brand: 'Sony',
      model: 'Alpha A7 IV',
      serial_number: 'SYA74-2023-009012',
      purchase_price: 18999,
      daily_rental_price: 150,
      deposit: 4000,
      status: 'rented',
      condition: 'excellent'
    },
    {
      equipment_id: 'EQ004',
      type: 'lens',
      brand: 'Sony',
      model: 'FE 70-200mm f/2.8 GM OSS II',
      serial_number: 'SYFE70200-2023-003456',
      purchase_price: 19999,
      daily_rental_price: 130,
      deposit: 3500,
      status: 'available',
      condition: 'good'
    },
    {
      equipment_id: 'EQ005',
      type: 'accessory',
      brand: 'DJI',
      model: 'Ronin-SC',
      serial_number: 'DJRSC-2023-007890',
      purchase_price: 2299,
      daily_rental_price: 35,
      deposit: 500,
      status: 'available',
      condition: 'fair'
    }
  ];

  for (const eq of equipment) {
    db.run(
      'INSERT OR REPLACE INTO equipment (equipment_id, type, brand, model, serial_number, purchase_price, daily_rental_price, deposit, status, condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [eq.equipment_id, eq.type, eq.brand, eq.model, eq.serial_number, eq.purchase_price, eq.daily_rental_price, eq.deposit, eq.status, eq.condition]
    );
  }

  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  const rentalOrders = [
    {
      order_id: 'ORD001',
      customer_id: 'CUST001',
      rental_start_date: twoWeeksAgo.toISOString(),
      expected_return_date: oneWeekAgo.toISOString(),
      total_amount: 2100,
      deposit_paid: 8000,
      status: 'overdue',
      pickup_location: '上海浦东店',
      return_location: '上海浦东店',
      staff_name: '陈明'
    },
    {
      order_id: 'ORD002',
      customer_id: 'CUST003',
      rental_start_date: oneWeekAgo.toISOString(),
      expected_return_date: threeDaysAgo.toISOString(),
      total_amount: 600,
      deposit_paid: 4000,
      status: 'overdue',
      pickup_location: '北京朝阳店',
      return_location: '北京朝阳店',
      staff_name: '刘芳'
    },
    {
      order_id: 'ORD003',
      customer_id: 'CUST002',
      rental_start_date: threeDaysAgo.toISOString(),
      expected_return_date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      total_amount: 900,
      deposit_paid: 3500,
      status: 'active',
      pickup_location: '深圳南山店',
      return_location: '深圳南山店',
      staff_name: '赵磊'
    }
  ];

  for (const order of rentalOrders) {
    db.run(
      'INSERT OR REPLACE INTO rental_orders (order_id, customer_id, rental_start_date, expected_return_date, total_amount, deposit_paid, status, pickup_location, return_location, staff_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [order.order_id, order.customer_id, order.rental_start_date, order.expected_return_date, order.total_amount, order.deposit_paid, order.status, order.pickup_location, order.return_location, order.staff_name]
    );
  }

  const rentalItems = [
    {
      item_id: 'ITEM001',
      order_id: 'ORD001',
      equipment_id: 'EQ001',
      daily_price: 180,
      quantity: 1
    },
    {
      item_id: 'ITEM002',
      order_id: 'ORD001',
      equipment_id: 'EQ002',
      daily_price: 120,
      quantity: 1,
      actual_return_date: oneWeekAgo.toISOString(),
      return_condition: 'good',
      return_staff: '陈明'
    },
    {
      item_id: 'ITEM003',
      order_id: 'ORD002',
      equipment_id: 'EQ003',
      daily_price: 150,
      quantity: 1
    },
    {
      item_id: 'ITEM004',
      order_id: 'ORD003',
      equipment_id: 'EQ004',
      daily_price: 130,
      quantity: 1
    }
  ];

  for (const item of rentalItems) {
    db.run(
      'INSERT OR REPLACE INTO rental_items (item_id, order_id, equipment_id, daily_price, quantity, actual_return_date, return_condition, return_staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item.item_id, item.order_id, item.equipment_id, item.daily_price, item.quantity, item.actual_return_date || null, item.return_condition || null, item.return_staff || null]
    );
  }

  const overdueDays1 = Math.floor((today.getTime() - oneWeekAgo.getTime()) / (1000 * 60 * 60 * 24));

  const overdueBills = [
    {
      bill_id: 'BILL001',
      order_id: 'ORD001',
      customer_id: 'CUST001',
      overdue_days: overdueDays1,
      overdue_amount: overdueDays1 * 180,
      equipment_ids: 'EQ001',
      status: 'pending',
      review_status: 'needs_review',
      review_notes: '客户已归还镜头（EQ002），但机身（EQ001）仍未归还。需要人工确认是否继续计算逾期费用或联系客户。'
    },
    {
      bill_id: 'BILL002',
      order_id: 'ORD002',
      customer_id: 'CUST003',
      overdue_days: 3,
      overdue_amount: 3 * 150,
      equipment_ids: 'EQ003',
      status: 'pending',
      review_status: 'pending'
    }
  ];

  for (const bill of overdueBills) {
    db.run(
      'INSERT OR REPLACE INTO overdue_bills (bill_id, order_id, customer_id, overdue_days, overdue_amount, equipment_ids, status, review_status, review_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [bill.bill_id, bill.order_id, bill.customer_id, bill.overdue_days, bill.overdue_amount, bill.equipment_ids, bill.status, bill.review_status, bill.review_notes || null]
    );
  }

  console.log('种子数据导入完成！');
  console.log('');
  console.log('📋 测试数据说明:');
  console.log('');
  console.log('👥 客户数据:');
  console.log('  - CUST001: 张伟 - 信用分85，有2次逾期记录');
  console.log('  - CUST002: 李娜 - 信用分95，无逾期记录');
  console.log('  - CUST003: 王强 - 信用分60，有3次逾期记录');
  console.log('');
  console.log('📷 设备数据:');
  console.log('  - EQ001: Canon EOS R5 机身 - 已出租');
  console.log('  - EQ002: Canon RF 24-70mm 镜头 - 已出租（已归还）');
  console.log('  - EQ003: Sony A7 IV 机身 - 已出租');
  console.log('  - EQ004: Sony FE 70-200mm 镜头 - 可租用');
  console.log('  - EQ005: DJI Ronin-SC 稳定器 - 可租用');
  console.log('');
  console.log('📝 租赁订单:');
  console.log('  - ORD001: 张伟 - 逾期7天 - 镜头已还，机身未还（特殊场景）');
  console.log('  - ORD002: 王强 - 逾期3天 - 全部未还');
  console.log('  - ORD003: 李娜 - 正常租用中');
  console.log('');
  console.log('💰 逾期账单:');
  console.log('  - BILL001: 对应ORD001 - 待人工审核（部分归还场景）');
  console.log('  - BILL002: 对应ORD002 - 待处理');
  console.log('');
  console.log('🚀 运行 npm run dev 启动服务器');
  console.log('📡 API 地址: http://localhost:3000');
  console.log('');

  db.close();
};

seedData().catch(console.error);
