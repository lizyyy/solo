const db = require('../config/database');
const initDatabase = require('../models/init');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  await initDatabase();

  const deviceId1 = 'DEV001';
  const deviceId2 = 'DEV002';
  const deviceId3 = 'DEV003';
  
  const couponId1 = 'COUPON001';
  const couponId2 = 'COUPON002';
  const couponId3 = 'COUPON003';
  const couponId4 = 'COUPON004';
  
  const orderId1 = 'ORDER001';
  const orderId2 = 'ORDER002';
  const orderId3 = 'ORDER003';

  const devices = [
    {
      device_id: deviceId1,
      device_name: '自助洗车机A-01',
      station_id: 'STATION001',
      station_name: '朝阳区望京洗车场',
      device_type: '全自动洗车机',
      status: 'online',
      last_heartbeat_at: '2024-01-15 14:30:00',
      location: '北京市朝阳区望京街道123号'
    },
    {
      device_id: deviceId2,
      device_name: '自助洗车机B-02',
      station_id: 'STATION001',
      station_name: '朝阳区望京洗车场',
      device_type: '高压水枪洗车机',
      status: 'offline',
      last_heartbeat_at: '2024-01-14 08:15:00',
      location: '北京市朝阳区望京街道123号'
    },
    {
      device_id: deviceId3,
      device_name: '自助洗车机C-01',
      station_id: 'STATION002',
      station_name: '海淀区中关村洗车场',
      device_type: '全自动洗车机',
      status: 'fault',
      last_heartbeat_at: '2024-01-15 10:00:00',
      location: '北京市海淀区中关村大街456号'
    }
  ];

  const coupons = [
    {
      coupon_id: couponId1,
      coupon_code: 'WASH202401001',
      coupon_type: '满减券',
      discount_amount: 15.00,
      min_consumption: 30.00,
      user_id: 'USER001',
      user_phone: '13800138001',
      status: 'available',
      valid_start_at: '2024-01-01 00:00:00',
      valid_end_at: '2024-12-31 23:59:59'
    },
    {
      coupon_id: couponId2,
      coupon_code: 'WASH202401002',
      coupon_type: '立减券',
      discount_amount: 10.00,
      min_consumption: 0,
      user_id: 'USER002',
      user_phone: '13800138002',
      status: 'used',
      valid_start_at: '2024-01-01 00:00:00',
      valid_end_at: '2024-12-31 23:59:59',
      used_at: '2024-01-15 10:30:00',
      used_device_id: deviceId1
    },
    {
      coupon_id: couponId3,
      coupon_code: 'WASH202401003',
      coupon_type: '折扣券',
      discount_amount: 8.00,
      min_consumption: 0,
      user_id: 'USER003',
      user_phone: '13800138003',
      status: 'available',
      valid_start_at: '2024-01-01 00:00:00',
      valid_end_at: '2024-06-30 23:59:59'
    },
    {
      coupon_id: couponId4,
      coupon_code: 'WASH202401004',
      coupon_type: '满减券',
      discount_amount: 20.00,
      min_consumption: 50.00,
      user_id: 'USER004',
      user_phone: '13800138004',
      status: 'expired',
      valid_start_at: '2023-01-01 00:00:00',
      valid_end_at: '2023-12-31 23:59:59'
    }
  ];

  const orders = [
    {
      order_id: orderId1,
      user_id: 'USER001',
      user_phone: '13800138001',
      device_id: deviceId1,
      station_id: 'STATION001',
      station_name: '朝阳区望京洗车场',
      car_plate: '京A12345',
      wash_type: '标准清洗',
      original_amount: 35.00,
      discount_amount: 15.00,
      actual_amount: 20.00,
      coupon_id: couponId1,
      status: 'completed',
      start_time: '2024-01-15 14:00:00',
      end_time: '2024-01-15 14:15:00'
    },
    {
      order_id: orderId2,
      user_id: 'USER002',
      user_phone: '13800138002',
      device_id: deviceId2,
      station_id: 'STATION001',
      station_name: '朝阳区望京洗车场',
      car_plate: '京B67890',
      wash_type: '精细清洗',
      original_amount: 50.00,
      discount_amount: 10.00,
      actual_amount: 40.00,
      coupon_id: couponId2,
      status: 'failed',
      start_time: '2024-01-15 09:00:00',
      end_time: null
    },
    {
      order_id: orderId3,
      user_id: 'USER003',
      user_phone: '13800138003',
      device_id: deviceId3,
      station_id: 'STATION002',
      station_name: '海淀区中关村洗车场',
      car_plate: '京C11111',
      wash_type: '标准清洗',
      original_amount: 35.00,
      discount_amount: 8.00,
      actual_amount: 27.00,
      coupon_id: couponId3,
      status: 'processing',
      start_time: '2024-01-15 11:00:00',
      end_time: null
    }
  ];

  const freezes = [
    {
      freeze_id: 'FREEZE001',
      order_id: orderId2,
      coupon_id: couponId2,
      user_id: 'USER002',
      device_id: deviceId2,
      station_id: 'STATION001',
      freeze_amount: 10.00,
      freeze_reason: '设备故障导致洗车失败',
      status: 'pending',
      operator_id: null,
      operator_name: null,
      audit_remark: null,
      audit_time: null
    }
  ];

  const exceptions = [
    {
      exception_id: 'EXCEPT001',
      order_id: orderId2,
      coupon_id: couponId2,
      user_id: 'USER002',
      device_id: deviceId2,
      station_id: 'STATION001',
      exception_type: '设备故障异常',
      exception_code: 'DEVICE_FAILED_COUPON_CONSUMED',
      exception_message: '设备离线导致洗车失败，但优惠券已被消费',
      coupon_consumed: 1,
      device_failed: 1,
      consistency_status: 'inconsistent',
      handle_status: 'pending'
    },
    {
      exception_id: 'EXCEPT002',
      order_id: orderId3,
      coupon_id: couponId3,
      user_id: 'USER003',
      device_id: deviceId3,
      station_id: 'STATION002',
      exception_type: '数据一致性异常',
      exception_code: 'DATA_INCONSISTENCY',
      exception_message: '优惠冻结记录与优惠券状态不一致',
      coupon_consumed: 0,
      device_failed: 1,
      consistency_status: 'inconsistent',
      handle_status: 'pending'
    }
  ];

  const insertDevice = db.prepare('INSERT OR REPLACE INTO car_wash_devices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  devices.forEach(d => {
    insertDevice.run(d.device_id, d.device_name, d.station_id, d.station_name, d.device_type, d.status, d.last_heartbeat_at, d.location, '2024-01-01 00:00:00');
  });

  const insertCoupon = db.prepare('INSERT OR REPLACE INTO coupons VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  coupons.forEach(c => {
    insertCoupon.run(c.coupon_id, c.coupon_code, c.coupon_type, c.discount_amount, c.min_consumption, c.user_id, c.user_phone, c.status, c.valid_start_at, c.valid_end_at, c.used_at, c.used_device_id, '2024-01-01 00:00:00');
  });

  const insertOrder = db.prepare('INSERT OR REPLACE INTO car_wash_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  orders.forEach(o => {
    insertOrder.run(o.order_id, o.user_id, o.user_phone, o.device_id, o.station_id, o.station_name, o.car_plate, o.wash_type, o.original_amount, o.discount_amount, o.actual_amount, o.coupon_id, o.status, o.start_time, o.end_time, '2024-01-01 00:00:00');
  });

  const insertFreeze = db.prepare('INSERT OR REPLACE INTO discount_freezes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  freezes.forEach(f => {
    insertFreeze.run(f.freeze_id, f.order_id, f.coupon_id, f.user_id, f.device_id, f.station_id, f.freeze_amount, f.freeze_reason, f.status, f.operator_id, f.operator_name, f.audit_remark, f.audit_time, '2024-01-01 00:00:00', '2024-01-01 00:00:00');
  });

  const insertException = db.prepare('INSERT OR REPLACE INTO discount_exceptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  exceptions.forEach(e => {
    insertException.run(e.exception_id, e.order_id, e.coupon_id, e.user_id, e.device_id, e.station_id, e.exception_type, e.exception_code, e.exception_message, e.coupon_consumed, e.device_failed, e.consistency_status, e.handle_status, e.handler_id, e.handler_name, e.handle_remark, e.handle_time, '2024-01-01 00:00:00', '2024-01-01 00:00:00');
  });

  console.log('种子数据插入完成');
  console.log('\n=== 样例数据概览 ===');
  console.log(`洗车设备: ${devices.length} 台`);
  console.log(`优惠券: ${coupons.length} 张`);
  console.log(`洗车订单: ${orders.length} 笔`);
  console.log(`优惠冻结记录: ${freezes.length} 笔`);
  console.log(`异常记录: ${exceptions.length} 笔`);
  console.log('\n=== 异常样例说明 ===');
  console.log('1. EXCEPT001: 设备离线导致洗车失败，但优惠券已被消费 - 待处理状态');
  console.log('2. EXCEPT002: 优惠冻结记录与优惠券状态不一致 - 待处理状态');
  
  db.close();
};

seedData();
