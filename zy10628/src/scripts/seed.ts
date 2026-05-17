import { Database } from '../database/Database';
import { DriverRepository, VehicleRepository, ShiftRepository, ShiftSwapRepository } from '../repositories';
import { ShiftSwapStatus, SwapReason } from '../types';

async function seed() {
  console.log('开始初始化种子数据...');
  
  const db = await Database.getInstance();
  
  const driverRepo = new DriverRepository(db);
  const vehicleRepo = new VehicleRepository(db);
  const shiftRepo = new ShiftRepository(db);
  const swapRepo = new ShiftSwapRepository(db);

  console.log('创建司机数据...');
  const driver1 = await driverRepo.create({
    name: '张三',
    phone: '13800138001',
    licenseNumber: 'A12345678',
    licenseType: 'A1',
    status: 'active'
  });

  const driver2 = await driverRepo.create({
    name: '李四',
    phone: '13800138002',
    licenseNumber: 'B12345678',
    licenseType: 'A2',
    status: 'active'
  });

  const driver3 = await driverRepo.create({
    name: '王五',
    phone: '13800138003',
    licenseNumber: 'C12345678',
    licenseType: 'A1',
    status: 'active'
  });

  const driver4 = await driverRepo.create({
    name: '赵六',
    phone: '13800138004',
    licenseNumber: 'D12345678',
    licenseType: 'A2',
    status: 'on_leave'
  });

  console.log('创建车辆数据...');
  const vehicle1 = await vehicleRepo.create({
    plateNumber: '京A12345',
    vehicleType: '大巴',
    capacity: 45,
    status: 'available'
  });

  const vehicle2 = await vehicleRepo.create({
    plateNumber: '京B67890',
    vehicleType: '中巴',
    capacity: 25,
    status: 'available'
  });

  console.log('创建班次数据...');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];

  const shift1 = await shiftRepo.create({
    driverId: driver1.id,
    vehicleId: vehicle1.id,
    shiftDate: tomorrow,
    startTime: '08:00:00',
    endTime: '16:00:00',
    route: '北京站 - 首都机场',
    status: 'scheduled'
  });

  const shift2 = await shiftRepo.create({
    driverId: driver2.id,
    vehicleId: vehicle2.id,
    shiftDate: tomorrow,
    startTime: '09:00:00',
    endTime: '17:00:00',
    route: '北京西站 - 大兴机场',
    status: 'scheduled'
  });

  const shift3 = await shiftRepo.create({
    driverId: driver1.id,
    vehicleId: vehicle1.id,
    shiftDate: dayAfter,
    startTime: '07:00:00',
    endTime: '15:00:00',
    route: '北京南站 - 首都机场',
    status: 'scheduled'
  });

  const shift4 = await shiftRepo.create({
    driverId: driver3.id,
    vehicleId: vehicle2.id,
    shiftDate: dayAfter,
    startTime: '14:00:00',
    endTime: '22:00:00',
    route: '北京站 - 大兴机场',
    status: 'scheduled'
  });

  console.log('创建完整流转的换班记录...');
  const swap1 = await swapRepo.create({
    originalShiftId: shift1.id,
    originalDriverId: driver1.id,
    newDriverId: driver2.id,
    swapReason: SwapReason.PERSONAL_AFFAIR,
    reasonDetail: '家里有事需要处理',
    status: ShiftSwapStatus.COMPLETED,
    confirmedById: 'admin',
    confirmedAt: new Date().toISOString()
  });

  await swapRepo.addHistory({
    swapId: swap1.id,
    previousStatus: '' as ShiftSwapStatus,
    newStatus: ShiftSwapStatus.PENDING_CONFIRM,
    changedBy: 'admin',
    changeReason: '创建申请'
  });
  await swapRepo.addHistory({
    swapId: swap1.id,
    previousStatus: ShiftSwapStatus.PENDING_CONFIRM,
    newStatus: ShiftSwapStatus.SWAPPED,
    changedBy: 'admin',
    changeReason: '审核通过'
  });
  await swapRepo.addHistory({
    swapId: swap1.id,
    previousStatus: ShiftSwapStatus.SWAPPED,
    newStatus: ShiftSwapStatus.COMPLETED,
    changedBy: 'system',
    changeReason: '班次完成'
  });

  console.log('创建冲突待判的换班记录...');
  const swap2 = await swapRepo.create({
    originalShiftId: shift2.id,
    originalDriverId: driver2.id,
    newDriverId: driver3.id,
    swapReason: SwapReason.SICK_LEAVE,
    reasonDetail: '感冒发烧，需要休息',
    status: ShiftSwapStatus.CONFLICT_PENDING,
    conflictReason: '新司机在同一时间段已有其他换班申请待处理'
  });

  await swapRepo.addHistory({
    swapId: swap2.id,
    previousStatus: '' as ShiftSwapStatus,
    newStatus: ShiftSwapStatus.CONFLICT_PENDING,
    changedBy: 'system',
    changeReason: '检测到时间冲突'
  });

  console.log('创建待确认的换班记录...');
  const swap3 = await swapRepo.create({
    originalShiftId: shift3.id,
    originalDriverId: driver1.id,
    newDriverId: driver3.id,
    swapReason: SwapReason.EMERGENCY,
    reasonDetail: '紧急事务',
    status: ShiftSwapStatus.PENDING_CONFIRM
  });

  await swapRepo.addHistory({
    swapId: swap3.id,
    previousStatus: '' as ShiftSwapStatus,
    newStatus: ShiftSwapStatus.PENDING_CONFIRM,
    changedBy: 'admin',
    changeReason: '创建申请'
  });

  console.log('创建已换班的记录...');
  const swap4 = await swapRepo.create({
    originalShiftId: shift4.id,
    originalDriverId: driver3.id,
    newDriverId: driver1.id,
    swapReason: SwapReason.OTHER,
    reasonDetail: '调班',
    status: ShiftSwapStatus.SWAPPED,
    confirmedById: 'admin',
    confirmedAt: new Date().toISOString()
  });

  await swapRepo.addHistory({
    swapId: swap4.id,
    previousStatus: '' as ShiftSwapStatus,
    newStatus: ShiftSwapStatus.PENDING_CONFIRM,
    changedBy: 'admin',
    changeReason: '创建申请'
  });
  await swapRepo.addHistory({
    swapId: swap4.id,
    previousStatus: ShiftSwapStatus.PENDING_CONFIRM,
    newStatus: ShiftSwapStatus.SWAPPED,
    changedBy: 'admin',
    changeReason: '审核通过'
  });

  console.log('\n种子数据创建完成！');
  console.log('\n=== 司机列表 ===');
  console.log([driver1, driver2, driver3, driver4].map(d => `${d.id} - ${d.name} (${d.status})`).join('\n'));
  
  console.log('\n=== 车辆列表 ===');
  console.log([vehicle1, vehicle2].map(v => `${v.id} - ${v.plateNumber} (${v.vehicleType})`).join('\n'));
  
  console.log('\n=== 班次列表 ===');
  console.log([shift1, shift2, shift3, shift4].map(s => `${s.id} - ${s.shiftDate} ${s.startTime}-${s.endTime} ${s.route}`).join('\n'));
  
  console.log('\n=== 换班记录 ===');
  const swaps = await swapRepo.findAll();
  console.log(swaps.map(s => `${s.id} - ${s.status} - ${s.swapReason}`).join('\n'));
  
  console.log('\n=== 验收场景说明 ===');
  console.log('1. 完整流转: swap1 (待确认 -> 已换班 -> 已完成) - 包含完整历史记录');
  console.log('2. 冲突记录: swap2 (冲突待判) - 包含冲突原因');
  console.log('3. 待确认记录: swap3 (待确认)');
  console.log('4. 已换班记录: swap4 (已换班)');
  console.log('5. 导入坏行: 可使用 driver4(休假中) 或无效ID进行测试');
  
  await Database.close();
}

seed().catch(console.error);
