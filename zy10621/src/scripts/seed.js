const { sequelize, Room, User, CompensationRecord } = require('../models');

async function seed() {
  console.log('开始初始化种子数据...');

  await sequelize.sync({ force: true });
  console.log('数据库表已重建');

  const users = await User.bulkCreate([
    { employeeId: 'EMP001', name: '张三', email: 'zhangsan@example.com', department: '技术部', phone: '13800138001' },
    { employeeId: 'EMP002', name: '李四', email: 'lisi@example.com', department: '市场部', phone: '13800138002' },
    { employeeId: 'EMP003', name: '王五', email: 'wangwu@example.com', department: '人事部', phone: '13800138003' },
    { employeeId: 'EMP004', name: '赵六', email: 'zhaoliu@example.com', department: '财务部', phone: '13800138004' }
  ]);
  console.log(`已创建 ${users.length} 个用户`);

  const rooms = await Room.bulkCreate([
    { name: '创新会议室-A', location: '1楼东侧', capacity: 10, hourlyRate: 150.00, equipment: ['投影仪', '白板', '视频会议系统'] },
    { name: '创新会议室-B', location: '1楼西侧', capacity: 8, hourlyRate: 120.00, equipment: ['投影仪', '白板'] },
    { name: '董事会议室', location: '2楼南侧', capacity: 20, hourlyRate: 300.00, equipment: ['投影仪', '白板', '视频会议系统', '音响系统'] },
    { name: '小型洽谈室', location: '3楼北侧', capacity: 4, hourlyRate: 80.00, equipment: ['白板'] }
  ]);
  console.log(`已创建 ${rooms.length} 个会议室`);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const records = await CompensationRecord.bulkCreate([
    {
      reservationId: 'RES20240115001',
      roomId: 1,
      userId: 1,
      startTime: new Date(tomorrow.setHours(9, 0, 0, 0)),
      endTime: new Date(tomorrow.setHours(11, 0, 0, 0)),
      status: CompensationRecord.STATUS.BOOKED,
      chargedAmount: 300.00
    },
    {
      reservationId: 'RES20240115002',
      roomId: 2,
      userId: 2,
      startTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
      endTime: new Date(tomorrow.setHours(16, 0, 0, 0)),
      status: CompensationRecord.STATUS.RELEASE_REQUEST,
      releaseReason: CompensationRecord.RELEASE_REASONS.MEETING_CANCELLED,
      releaseReasonDetail: '参会人员临时调整，会议取消',
      chargedAmount: 240.00
    },
    {
      reservationId: 'RES20240115003',
      roomId: 3,
      userId: 3,
      startTime: new Date(dayAfter.setHours(10, 0, 0, 0)),
      endTime: new Date(dayAfter.setHours(12, 0, 0, 0)),
      status: CompensationRecord.STATUS.PENDING_MANUAL,
      releaseReason: CompensationRecord.RELEASE_REASONS.EQUIPMENT_FAILURE,
      releaseReasonDetail: '投影仪无法正常开机',
      affectedEquipment: ['投影仪'],
      chargedAmount: 600.00,
      explanation: '设备故障导致会议室无法使用，但系统仍自动扣费，需人工核实后进行补偿\n扣费金额: ¥600.00\n受影响设备: 投影仪'
    }
  ]);
  console.log(`已创建 ${records.length} 条预约记录`);

  console.log('种子数据初始化完成!');
  console.log('\n测试账号:');
  users.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.name} (ID: ${user.id}, ${user.department})`);
  });
  console.log('\n会议室:');
  rooms.forEach((room, index) => {
    console.log(`  ${index + 1}. ${room.name} (ID: ${room.id}, ¥${room.hourlyRate}/小时)`);
  });
  
  await sequelize.close();
}

seed().catch(console.error);
