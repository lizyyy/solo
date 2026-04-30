const db = require('./database');

const sampleBookings = [
  {
    customer_name: '张三',
    phone: '13800138001',
    studio: 'A',
    booking_date: '2026-04-30',
    start_time: '09:00',
    end_time: '11:00',
    deposit_amount: 500,
    status: 'verified',
    note: '产品拍摄，需要白色背景'
  },
  {
    customer_name: '李四',
    phone: '13900139002',
    studio: 'A',
    booking_date: '2026-04-30',
    start_time: '14:00',
    end_time: '17:00',
    deposit_amount: 800,
    status: 'verified',
    note: '人像写真'
  },
  {
    customer_name: '王五',
    phone: '13700137003',
    studio: 'B',
    booking_date: '2026-05-01',
    start_time: '10:00',
    end_time: '13:00',
    deposit_amount: 600,
    status: 'deposited',
    note: '电商产品拍摄，3组灯光'
  },
  {
    customer_name: '赵六',
    phone: '13600136004',
    studio: 'B',
    booking_date: '2026-05-02',
    start_time: '09:00',
    end_time: '12:00',
    deposit_amount: 400,
    status: 'pending',
    note: '证件照拍摄'
  },
  {
    customer_name: '孙七',
    phone: '13500135005',
    studio: 'C',
    booking_date: '2026-05-05',
    start_time: '13:00',
    end_time: '18:00',
    deposit_amount: 1200,
    status: 'deposited',
    note: '婚纱写真，需要化妆间'
  },
  {
    customer_name: '周八',
    phone: '13400134006',
    studio: 'A',
    booking_date: '2026-04-28',
    start_time: '10:00',
    end_time: '12:00',
    deposit_amount: 300,
    status: 'deposited',
    note: '逾期示例 - 应已完成但未核销'
  }
];

async function insertSampleData() {
  console.log('检查是否需要插入示例数据...');
  
  const existing = await db.all(`SELECT COUNT(*) as count FROM bookings`);
  
  if (existing[0].count > 0) {
    console.log('数据库已有数据，跳过示例数据插入');
    return;
  }

  console.log('插入示例数据...');

  for (const booking of sampleBookings) {
    const result = await db.run(`
      INSERT INTO bookings 
      (customer_name, phone, studio, booking_date, start_time, end_time, deposit_amount, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      booking.customer_name, booking.phone, booking.studio,
      booking.booking_date, booking.start_time, booking.end_time,
      booking.deposit_amount, booking.status, booking.note
    ]);

    const bookingId = result.lastID;

    let initialNote = `创建预约 - 客户: ${booking.customer_name}, 棚位: ${booking.studio}, 日期: ${booking.booking_date}, 时间: ${booking.start_time}-${booking.end_time}`;
    
    await db.run(`
      INSERT INTO audit_logs (booking_id, action, from_status, to_status, note)
      VALUES (?, 'create', NULL, 'pending', ?)
    `, [bookingId, initialNote]);

    if (booking.status === 'deposited') {
      await db.run(`
        INSERT INTO audit_logs (booking_id, action, from_status, to_status, note)
        VALUES (?, 'deposit', 'pending', 'deposited', ?)
      `, [bookingId, `收取押金 ¥${booking.deposit_amount}`]);
    } else if (booking.status === 'verified') {
      await db.run(`
        INSERT INTO audit_logs (booking_id, action, from_status, to_status, note)
        VALUES (?, 'deposit', 'pending', 'deposited', ?)
      `, [bookingId, `收取押金 ¥${booking.deposit_amount}`]);
      
      await db.run(`
        INSERT INTO audit_logs (booking_id, action, from_status, to_status, note)
        VALUES (?, 'verify', 'deposited', 'verified', ?)
      `, [bookingId, `核销预约，押金 ¥${booking.deposit_amount} 已确认`]);
    }
  }

  console.log(`${sampleBookings.length} 条示例数据已插入`);
}

module.exports = {
  insertSampleData,
  sampleBookings
};
