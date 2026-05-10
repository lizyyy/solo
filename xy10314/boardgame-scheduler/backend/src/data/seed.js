const { initDatabase, get } = require('../models/database');
const TableModel = require('../models/TableModel');
const ScriptModel = require('../models/ScriptModel');
const HostModel = require('../models/HostModel');
const ReservationService = require('../services/ReservationService');

async function seedData() {
  await initDatabase();

  const existingTables = await get('SELECT COUNT(*) as count FROM tables');
  if (existingTables.count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  const tables = [
    { name: 'A1-包厢', capacity: 8, location: '一楼VIP区' },
    { name: 'A2-大厅', capacity: 10, location: '一楼大厅' },
    { name: 'B1-小包', capacity: 6, location: '二楼' },
    { name: 'B2-小包', capacity: 6, location: '二楼' },
    { name: 'C1-大包', capacity: 12, location: '三楼' }
  ];

  const createdTables = [];
  for (const t of tables) {
    createdTables.push(await TableModel.create(t));
  }
  console.log('已创建桌位:', createdTables.length);

  const scripts = [
    { name: '古木吟', duration_minutes: 240, min_players: 6, max_players: 6, difficulty: 'hard', price: 158, description: '情感沉浸本' },
    { name: '年轮', duration_minutes: 180, min_players: 5, max_players: 5, difficulty: 'medium', price: 128, description: '经典硬核本' },
    { name: '窗边的女人', duration_minutes: 150, min_players: 6, max_players: 6, difficulty: 'medium', price: 118, description: '微恐推理' },
    { name: '病娇男孩的精分日记', duration_minutes: 210, min_players: 7, max_players: 7, difficulty: 'medium', price: 138, description: '惊悚还原' },
    { name: '漓川怪谈簿', duration_minutes: 240, min_players: 7, max_players: 7, difficulty: 'medium', price: 148, description: '日式变格' }
  ];

  const createdScripts = [];
  for (const s of scripts) {
    createdScripts.push(await ScriptModel.create(s));
  }
  console.log('已创建剧本:', createdScripts.length);

  const hosts = [
    { name: '小李', phone: '13800138001', email: 'li@example.com', skills: '情感本、硬核本' },
    { name: '小王', phone: '13800138002', email: 'wang@example.com', skills: '恐怖本、欢乐本' },
    { name: '小张', phone: '13800138003', email: 'zhang@example.com', skills: '硬核本、机制本' },
    { name: '小陈', phone: '13800138004', email: 'chen@example.com', skills: '情感本、沉浸本' }
  ];

  const createdHosts = [];
  for (const h of hosts) {
    createdHosts.push(await HostModel.create(h));
  }
  console.log('已创建主持人:', createdHosts.length);

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  await HostModel.addLeave({
    host_id: createdHosts[2].id,
    leave_date: dateStr,
    start_time: '14:00',
    end_time: '20:00',
    reason: '个人事假'
  });
  console.log('已添加主持人请假: 小张 (14:00-20:00)');

  const privateBooking = {
    customer_name: '张三包场',
    customer_phone: '13900139001',
    table_id: createdTables[0].id,
    script_id: createdScripts[0].id,
    host_id: createdHosts[0].id,
    reservation_type: 'private',
    date: dateStr,
    start_time: '14:00',
    player_count: 6,
    status: 'confirmed',
    notes: 'VIP客户，需要提前准备零食'
  };
  const privateResult = await ReservationService.createReservation(privateBooking, 'seed-private-1', 'system');
  console.log('已创建包场预约:', privateResult.success ? '成功' : '失败');

  const sharedBooking1 = {
    customer_name: '李四散客',
    customer_phone: '13900139002',
    table_id: createdTables[1].id,
    script_id: createdScripts[2].id,
    host_id: createdHosts[1].id,
    reservation_type: 'shared',
    date: dateStr,
    start_time: '15:00',
    player_count: 3,
    status: 'confirmed',
    notes: '需要拼桌'
  };
  const sharedResult1 = await ReservationService.createReservation(sharedBooking1, 'seed-shared-1', 'system');
  console.log('已创建散客拼桌1:', sharedResult1.success ? '成功' : '失败');

  const hostConflictBooking = {
    customer_name: '王五测试',
    customer_phone: '13900139003',
    table_id: createdTables[2].id,
    script_id: createdScripts[1].id,
    host_id: createdHosts[2].id,
    reservation_type: 'shared',
    date: dateStr,
    start_time: '15:00',
    player_count: 5,
    status: 'pending',
    notes: '测试主持人请假冲突'
  };
  const conflictResult = await ReservationService.validateReservation(hostConflictBooking);
  console.log('主持人请假冲突验证:', conflictResult.errors);

  const waitlistItem = {
    customer_name: '赵六候补',
    customer_phone: '13900139004',
    script_id: createdScripts[0].id,
    date: dateStr,
    start_time: '14:00',
    player_count: 5,
    priority: 1
  };
  const waitlistResult = await ReservationService.addToWaitlist(waitlistItem, 'seed-waitlist-1', 'system');
  console.log('已创建候补记录:', waitlistResult.success ? '成功' : '失败');

  console.log('\n=== 样例数据初始化完成 ===');
  console.log(`日期: ${dateStr}`);
  console.log('1. 包场: 张三 - 古木吟 - 14:00 - A1包厢');
  console.log('2. 拼桌: 李四 - 窗边的女人 - 15:00 - A2大厅 (3人待拼)');
  console.log('3. 冲突: 预约主持人小张(15:00) - 与请假时间冲突');
  console.log('4. 候补: 赵六 - 古木吟 - 14:00');
}

if (require.main === module) {
  seedData().catch(console.error);
}

module.exports = { seedData };
