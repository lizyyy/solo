import { v4 as uuidv4 } from 'uuid';
import '../database';
import { db } from '../database';
import dayjs from 'dayjs';

const storeId = 'store-001';
const room1Id = 'room-001';
const room2Id = 'room-002';
const room3Id = 'room-003';

function run() {
  db.serialize(() => {
    db.run('DELETE FROM revenue_records');
    db.run('DELETE FROM status_logs');
    db.run('DELETE FROM bookings');
    db.run('DELETE FROM customers');
    db.run('DELETE FROM rooms');
    db.run('DELETE FROM stores');

    db.run(
      `INSERT INTO stores (id, name, address, phone, openTime, closeTime)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [storeId, '琴韵中心店', '上海市徐汇区音乐路100号', '021-12345678', '09:00', '22:00']
    );

    db.run(
      `INSERT INTO rooms (id, storeId, name, capacity, pricePerHour, status, equipment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room1Id, storeId, 'A1-标准琴房', 1, 50, 'available', '雅马哈三角钢琴']
    );

    db.run(
      `INSERT INTO rooms (id, storeId, name, capacity, pricePerHour, status, equipment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room2Id, storeId, 'A2-豪华琴房', 2, 80, 'available', '施坦威三角钢琴,监控系统']
    );

    db.run(
      `INSERT INTO rooms (id, storeId, name, capacity, pricePerHour, status, equipment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room3Id, storeId, 'B1-练习琴房', 1, 30, 'available', '珠江立式钢琴']
    );

    const now = dayjs();
    const today = now.format('YYYY-MM-DD');
    
    const customers = [
      { id: 'cust-001', name: '张小明', phone: '13800138001', vipLevel: 'gold' },
      { id: 'cust-002', name: '李小红', phone: '13800138002', vipLevel: 'silver' },
      { id: 'cust-003', name: '王大伟', phone: '13800138003', vipLevel: 'platinum' },
      { id: 'cust-004', name: '赵小芳', phone: '13800138004', vipLevel: 'normal' },
      { id: 'cust-005', name: '刘小强', phone: '13800138005', vipLevel: 'normal' },
      { id: 'cust-006', name: '陈小美', phone: '13800138006', vipLevel: 'gold' }
    ];

    customers.forEach(c => {
      db.run(
        `INSERT INTO customers (id, name, phone, vipLevel, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.phone, c.vipLevel, dayjs().subtract(Math.random() * 365, 'day').toISOString()]
      );
    });

    const bookings = [
      {
        id: 'booking-001',
        customerId: 'cust-001',
        customerName: '张小明',
        customerPhone: '13800138001',
        roomId: room1Id,
        startTime: dayjs(`${today} 10:00`).toISOString(),
        endTime: dayjs(`${today} 12:00`).toISOString(),
        status: 'completed',
        totalPrice: 100,
        paidAmount: 100,
        checkInTime: dayjs(`${today} 09:58`).toISOString(),
        checkOutTime: dayjs(`${today} 12:05`).toISOString(),
        notes: '正常预约，已完成'
      },
      {
        id: 'booking-002',
        customerId: 'cust-002',
        customerName: '李小红',
        customerPhone: '13800138002',
        roomId: room1Id,
        startTime: dayjs(`${today} 13:00`).toISOString(),
        endTime: dayjs(`${today} 15:00`).toISOString(),
        status: 'late_released',
        totalPrice: 100,
        paidAmount: 0,
        lateMinutes: 25,
        notes: '迟到超过15分钟，自动释放'
      },
      {
        id: 'booking-003',
        customerId: 'cust-003',
        customerName: '王大伟',
        customerPhone: '13800138003',
        roomId: room2Id,
        startTime: dayjs(`${today} 14:00`).toISOString(),
        endTime: dayjs(`${today} 16:00`).toISOString(),
        status: 'in_use',
        totalPrice: 160,
        paidAmount: 160,
        checkInTime: dayjs(`${today} 13:55`).toISOString(),
        notes: '使用中，尝试续时会失败'
      },
      {
        id: 'booking-004',
        customerId: 'cust-004',
        customerName: '赵小芳',
        customerPhone: '13800138004',
        roomId: room2Id,
        startTime: dayjs(`${today} 16:00`).toISOString(),
        endTime: dayjs(`${today} 18:00`).toISOString(),
        status: 'confirmed',
        totalPrice: 160,
        paidAmount: 0,
        notes: '已预约，导致王大伟无法续时'
      },
      {
        id: 'booking-005',
        customerId: 'cust-005',
        customerName: '刘小强',
        customerPhone: '13800138005',
        roomId: room1Id,
        startTime: dayjs(`${today} 15:00`).toISOString(),
        endTime: dayjs(`${today} 17:00`).toISOString(),
        status: 'room_changed',
        totalPrice: 100,
        paidAmount: 0,
        originalRoomId: room1Id,
        notes: '原预约，已换房'
      },
      {
        id: 'booking-006',
        customerId: 'cust-005',
        customerName: '刘小强',
        customerPhone: '13800138005',
        roomId: room3Id,
        startTime: dayjs(`${today} 15:00`).toISOString(),
        endTime: dayjs(`${today} 17:00`).toISOString(),
        status: 'in_use',
        totalPrice: 60,
        paidAmount: 60,
        checkInTime: dayjs(`${today} 15:05`).toISOString(),
        originalRoomId: room1Id,
        notes: '换房成功，从A1换到B1'
      },
      {
        id: 'booking-007',
        customerId: 'cust-006',
        customerName: '陈小美',
        customerPhone: '13800138006',
        roomId: room3Id,
        startTime: dayjs(`${today} 10:00`).toISOString(),
        endTime: dayjs(`${today} 12:00`).toISOString(),
        status: 'completed',
        totalPrice: 60,
        paidAmount: 60,
        isExtended: true,
        extendCount: 1,
        checkInTime: dayjs(`${today} 09:55`).toISOString(),
        checkOutTime: dayjs(`${today} 12:00`).toISOString(),
        originalEndTime: dayjs(`${today} 11:00`).toISOString(),
        notes: '续时成功的案例'
      },
      {
        id: 'booking-008',
        customerId: 'cust-001',
        customerName: '张小明',
        customerPhone: '13800138001',
        roomId: room1Id,
        startTime: dayjs().add(1, 'day').hour(14).minute(0).second(0).toISOString(),
        endTime: dayjs().add(1, 'day').hour(16).minute(0).second(0).toISOString(),
        status: 'confirmed',
        totalPrice: 100,
        paidAmount: 0,
        notes: '明天的预约'
      }
    ];

    bookings.forEach(b => {
      db.run(
        `INSERT INTO bookings (
          id, storeId, roomId, customerId, customerName, customerPhone,
          startTime, endTime, originalStartTime, originalEndTime, originalRoomId,
          status, checkInTime, checkOutTime, totalPrice, paidAmount,
          lateMinutes, isExtended, extendCount, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id, storeId, b.roomId, b.customerId, b.customerName, b.customerPhone,
          b.startTime, b.endTime, undefined, b.originalEndTime, b.originalRoomId,
          b.status, b.checkInTime, b.checkOutTime, b.totalPrice, b.paidAmount,
          b.lateMinutes || 0, b.isExtended ? 1 : 0, b.extendCount || 0, b.notes,
          dayjs().subtract(Math.random() * 24, 'hour').toISOString(),
          new Date().toISOString()
        ]
      );
    });

    const logs = [
      { bookingId: 'booking-001', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      { bookingId: 'booking-001', from: 'confirmed', to: 'in_use', operator: '前台', reason: '办理签到' },
      { bookingId: 'booking-001', from: 'in_use', to: 'completed', operator: '前台', reason: '退房完成' },
      
      { bookingId: 'booking-002', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      { bookingId: 'booking-002', from: 'confirmed', to: 'late_released', operator: '系统', reason: '迟到25分钟未签到，自动释放' },
      
      { bookingId: 'booking-003', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      { bookingId: 'booking-003', from: 'confirmed', to: 'in_use', operator: '前台', reason: '办理签到' },
      
      { bookingId: 'booking-004', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      
      { bookingId: 'booking-005', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      { bookingId: 'booking-005', from: 'confirmed', to: 'room_changed', operator: '前台', reason: '换房至B1-练习琴房' },
      
      { bookingId: 'booking-006', from: undefined, to: 'in_use', operator: '前台', reason: '从room-001换入' },
      
      { bookingId: 'booking-007', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' },
      { bookingId: 'booking-007', from: 'confirmed', to: 'in_use', operator: '前台', reason: '办理签到' },
      { bookingId: 'booking-007', from: 'in_use', to: 'in_use', operator: '前台', reason: '续时60分钟，增加费用¥30' },
      { bookingId: 'booking-007', from: 'in_use', to: 'completed', operator: '前台', reason: '退房完成' },
      
      { bookingId: 'booking-008', from: undefined, to: 'confirmed', operator: '前台', reason: '新建预约' }
    ];

    logs.forEach(log => {
      db.run(
        `INSERT INTO status_logs (id, bookingId, fromStatus, toStatus, operator, reason, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), log.bookingId, log.from, log.to, log.operator, log.reason, 
          dayjs().subtract(Math.random() * 12, 'hour').toISOString()]
      );
    });

    const revenues = [
      { bookingId: 'booking-001', customerId: 'cust-001', amount: 100, method: 'mobile' },
      { bookingId: 'booking-003', customerId: 'cust-003', amount: 160, method: 'card' },
      { bookingId: 'booking-006', customerId: 'cust-005', amount: 60, method: 'cash' },
      { bookingId: 'booking-007', customerId: 'cust-006', amount: 60, method: 'prepaid' }
    ];

    revenues.forEach(r => {
      db.run(
        `INSERT INTO revenue_records (id, bookingId, storeId, customerId, amount, paymentMethod, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), r.bookingId, storeId, r.customerId, r.amount, r.method,
          dayjs().subtract(Math.random() * 8, 'hour').toISOString()]
      );
    });

    console.log('✅ Seed data created successfully!');
    console.log('\n📊 Generated scenarios:');
    console.log('1. booking-001: 正常预约，已完成');
    console.log('2. booking-002: 迟到释放（迟到25分钟）');
    console.log('3. booking-003: 使用中，尝试续时会失败（因booking-004占用）');
    console.log('4. booking-004: 下一位顾客预约，导致续时失败');
    console.log('5. booking-005 & booking-006: 换房成功（A1→B1）');
    console.log('6. booking-007: 续时成功案例');
    console.log('7. booking-008: 明天的预约');
  });
}

setTimeout(run, 500);
