const db = require('../src/database');
const ForkliftService = require('../src/services/forklift.service');
const ChargingService = require('../src/services/charging.service');
const ShiftService = require('../src/services/shift.service');
const TaskService = require('../src/services/task.service');
const logger = require('../src/utils/logger');

const sampleForklifts = [
  { code: 'FL-001', name: '叉车一号', batteryLevel: 85, status: 'idle', operatorName: '张三', operatorPhone: '13800138001' },
  { code: 'FL-002', name: '叉车二号', batteryLevel: 45, status: 'working', operatorName: '李四', operatorPhone: '13800138002' },
  { code: 'FL-003', name: '叉车三号', batteryLevel: 15, status: 'low_battery', operatorName: '王五', operatorPhone: '13800138003' },
  { code: 'FL-004', name: '叉车四号', batteryLevel: 100, status: 'idle', operatorName: '赵六', operatorPhone: '13800138004' },
  { code: 'FL-005', name: '叉车五号', batteryLevel: 60, status: 'maintenance', operatorName: '钱七', operatorPhone: '13800138005' },
];

const sampleStations = [
  { code: 'CS-001', name: '充电桩A', status: 'available' },
  { code: 'CS-002', name: '充电桩B', status: 'available' },
  { code: 'CS-003', name: '充电桩C', status: 'available' },
  { code: 'CS-004', name: '充电桩D', status: 'maintenance' },
];

const sampleShifts = [
  { date: '2024-01-15', type: 'night', startTime: '20:00', endTime: '06:00', supervisorName: '张主管', status: 'completed' },
  { date: '2024-01-16', type: 'night', startTime: '20:00', endTime: '06:00', supervisorName: '李主管', status: 'in_progress' },
  { date: '2024-01-17', type: 'night', startTime: '20:00', endTime: '06:00', supervisorName: '王主管', status: 'scheduled' },
];

const importData = async () => {
  try {
    logger.info('开始导入示例数据...');
    
    await db.initTables();
    
    logger.info('导入叉车数据...');
    for (const forklift of sampleForklifts) {
      await ForkliftService.create(forklift, 'system');
    }
    logger.info(`✓ 导入 ${sampleForklifts.length} 台叉车`);
    
    logger.info('导入充电桩数据...');
    for (const station of sampleStations) {
      await ChargingService.create(station, 'system');
    }
    logger.info(`✓ 导入 ${sampleStations.length} 个充电桩`);
    
    logger.info('导入班次数据...');
    const shiftIds = [];
    for (const shift of sampleShifts) {
      const createdShift = await ShiftService.create(shift, 'system');
      shiftIds.push(createdShift.id);
    }
    logger.info(`✓ 导入 ${sampleShifts.length} 个班次`);
    
    if (shiftIds.length > 0) {
      logger.info('导入任务数据...');
      const forklifts = await ForkliftService.getAll(false);
      const tasks = [
        { code: 'T-001', shiftId: shiftIds[1], type: 'loading', priority: 'high', description: 'A区货物装载', location: 'A-01', estimatedDuration: 60, status: 'completed', operatorName: '张三' },
        { code: 'T-002', shiftId: shiftIds[1], type: 'unloading', priority: 'normal', description: 'B区货物卸载', location: 'B-02', estimatedDuration: 45, status: 'in_progress', operatorName: '李四', forkliftId: forklifts[1]?.id },
        { code: 'T-003', shiftId: shiftIds[1], type: 'transfer', priority: 'urgent', description: '紧急转运', location: 'C-03', estimatedDuration: 30, status: 'assigned', operatorName: '赵六', forkliftId: forklifts[3]?.id },
        { code: 'T-004', shiftId: shiftIds[1], type: 'inventory', priority: 'low', description: '库存盘点', location: 'D-04', estimatedDuration: 120, status: 'pending' },
        { code: 'T-005', shiftId: shiftIds[2], type: 'loading', priority: 'normal', description: '次日任务1', location: 'A-01', estimatedDuration: 90, status: 'pending' },
        { code: 'T-006', shiftId: shiftIds[2], type: 'unloading', priority: 'high', description: '次日任务2', location: 'B-02', estimatedDuration: 60, status: 'pending' },
      ];
      
      for (const task of tasks) {
        await TaskService.create(task, 'system');
      }
      logger.info(`✓ 导入 ${tasks.length} 个任务`);
    }
    
    await db.closeConnection();
    logger.info('✓ 数据导入完成！');
    logger.info('');
    logger.info('📊 数据统计:');
    logger.info(`   - 叉车: ${sampleForklifts.length} 台');
    logger.info(`   - 充电桩: ${sampleStations.length} 个`);
    logger.info(`   - 班次: ${sampleShifts.length} 个`);
    logger.info(`   - 任务: 6 个`);
    logger.info('');
    logger.info('⚠️  包含异常场景:');
    logger.info('   - FL-003 电量低 (15%)');
    logger.info('   - FL-005 正在维护');
    logger.info('   - CS-004 充电桩正在维护');
    logger.info('   - 包含待分配、进行中、已完成等多种状态');
    
  } catch (error) {
    logger.error('数据导入失败:', error);
    process.exit(1);
  }
};

importData();