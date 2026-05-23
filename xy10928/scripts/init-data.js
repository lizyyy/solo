const { exec, prepare } = require('../src/config/database');
const initDatabase = require('../src/models/init');
const moment = require('moment');

async function initSampleData() {
  console.log('开始初始化样例数据...');
  
  await initDatabase();
  
  await exec('PRAGMA foreign_keys = OFF');
  await exec('DELETE FROM return_reports');
  await exec('DELETE FROM rejection_records');
  await exec('DELETE FROM reminder_records');
  await exec('DELETE FROM packages');
  await exec('DELETE FROM recipients');
  await exec('DELETE FROM exception_logs');
  await exec('PRAGMA foreign_keys = ON');
  
  const recipients = [
    { name: '张三', phone: '13800138001', address: '北京市朝阳区XX小区1号楼' },
    { name: '李四', phone: '13800138002', address: '北京市海淀区XX小区2号楼' },
    { name: '王五', phone: '13800138003', address: '北京市西城区XX小区3号楼' },
    { name: '赵六', phone: '13800138004', address: '北京市东城区XX小区4号楼' },
    { name: '钱七', phone: '13800138005', address: '北京市丰台区XX小区5号楼' }
  ];
  
  const recipientStmt = prepare('INSERT INTO recipients (name, phone, address) VALUES (?, ?, ?)');
  for (const r of recipients) {
    await recipientStmt.run(r.name, r.phone, r.address);
  }
  
  const packageStmt = prepare(`
    INSERT INTO packages 
    (tracking_number, recipient_id, courier_company, weight, status, storage_location, in_time, reminder_count, retention_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const now = moment();
  const packages = [
    {
      tracking_number: 'SF1234567890001',
      recipient_id: 1,
      courier_company: '顺丰速运',
      weight: 1.2,
      status: 'in_stock',
      storage_location: 'A-01-01',
      in_time: now.clone().subtract(3, 'days').format('YYYY-MM-DD HH:mm:ss'),
      reminder_count: 2,
      retention_level: 'critical'
    },
    {
      tracking_number: 'YT1234567890002',
      recipient_id: 2,
      courier_company: '圆通速递',
      weight: 0.8,
      status: 'pending_pickup',
      storage_location: 'A-01-02',
      in_time: now.clone().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
      reminder_count: 1,
      retention_level: 'urgent'
    },
    {
      tracking_number: 'ZT1234567890003',
      recipient_id: 3,
      courier_company: '中通快递',
      weight: 2.5,
      status: 'in_stock',
      storage_location: 'A-02-01',
      in_time: now.clone().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      reminder_count: 0,
      retention_level: 'warning'
    },
    {
      tracking_number: 'YD1234567890004',
      recipient_id: 4,
      courier_company: '韵达快递',
      weight: 0.5,
      status: 'in_stock',
      storage_location: 'B-01-01',
      in_time: now.clone().subtract(6, 'hours').format('YYYY-MM-DD HH:mm:ss'),
      reminder_count: 0,
      retention_level: 'normal'
    },
    {
      tracking_number: 'EMS123456789005',
      recipient_id: 5,
      courier_company: 'EMS',
      weight: 3.0,
      status: 'rejected',
      storage_location: 'C-01-01',
      in_time: now.clone().subtract(4, 'days').format('YYYY-MM-DD HH:mm:ss'),
      reminder_count: 3,
      retention_level: 'critical'
    }
  ];
  
  for (const pkg of packages) {
    await packageStmt.run(
      pkg.tracking_number, pkg.recipient_id, pkg.courier_company,
      pkg.weight, pkg.status, pkg.storage_location,
      pkg.in_time, pkg.reminder_count, pkg.retention_level
    );
  }
  
  const reminderStmt = prepare(`
    INSERT INTO reminder_records (package_id, reminder_type, reminder_time, channel, content)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const reminders = [
    { package_id: 1, type: 'first', time: now.clone().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'), channel: 'sms', content: '您的包裹已到达驿站，请及时取件' },
    { package_id: 1, type: 'urgent', time: now.clone().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), channel: 'sms', content: '【紧急提醒】您的包裹已滞留3天，请尽快取件' },
    { package_id: 2, type: 'first', time: now.clone().subtract(12, 'hours').format('YYYY-MM-DD HH:mm:ss'), channel: 'sms', content: '您的包裹已到达驿站，请及时取件' }
  ];
  
  for (const r of reminders) {
    await reminderStmt.run(r.package_id, r.type, r.time, r.channel, r.content);
  }
  
  const rejectionStmt = prepare(`
    INSERT INTO rejection_records (package_id, reason, description, rejected_at, handler, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  await rejectionStmt.run(
    5, '商品破损', '收件人开箱发现外包装破损，内件有损坏',
    now.clone().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '李站长', 'pending_return'
  );
  
  console.log('样例数据初始化完成！');
  console.log(`- 收件人: ${recipients.length} 条`);
  console.log(`- 包裹: ${packages.length} 条`);
  console.log(`- 催取记录: ${reminders.length} 条`);
  console.log(`- 拒收记录: 1 条`);
}

if (require.main === module) {
  initSampleData().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = initSampleData;
