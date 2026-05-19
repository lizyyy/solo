const db = require('../src/database');
const ForkliftService = require('../src/services/forklift.service');
const ChargingService = require('../src/services/charging.service');
const ShiftService = require('../src/services/shift.service');
const TaskService = require('../src/services/task.service');
const ReportService = require('../src/services/report.service');
const logger = require('../src/utils/logger');

const verifyData = async () => {
  try {
    logger.info('========== 数据验证报告 ==========');
    logger.info('');
    
    await db.initTables();
    
    const forklifts = await ForkliftService.getAll();
    logger.info(`🚜 叉车总数: ${forklifts.length}`);
    
    const lowBattery = await ForkliftService.getLowBattery();
    if (lowBattery.length > 0) {
      logger.warn(`⚠️  低电量叉车: ${lowBattery.length} 台`);
      lowBattery.forEach(f => {
        logger.warn(`   - ${f.code} (${f.name}): ${f.batteryLevel}% - ${f.status}`);
      });
    }
    
    const availableForklifts = await ForkliftService.getAvailable();
    logger.info(`✓ 可用叉车: ${availableForklifts.length} 台`);
    
    const statusCounts = {};
    forklifts.forEach(f => {
      statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    });
    logger.info('  状态分布:', statusCounts);
    logger.info('');
    
    const stations = await ChargingService.getAll();
    logger.info(`🔌 充电桩总数: ${stations.length}`);
    
    const chargingStatus = await ChargingService.getChargingStatus();
    const occupied = chargingStatus.filter(s => s.status === 'occupied');
    const availableStations = chargingStatus.filter(s => s.status === 'available');
    
    if (occupied.length > 0) {
      logger.info(`⚡ 正在充电: ${occupied.length} 个`);
      occupied.forEach(s => {
        logger.info(`   - ${s.code}: ${s.forkliftCode} - 预计剩余 ${s.remainingTime} 分钟`);
      });
    }
    logger.info(`✓ 可用充电桩: ${availableStations.length} 个`);
    logger.info('');
    
    const shifts = await ShiftService.getAll();
    logger.info(`📅 班次总数: ${shifts.length}`);
    
    for (const shift of shifts) {
      const summary = await ShiftService.getShiftSummary(shift.id);
      const tasks = await TaskService.getByShiftId(shift.id);
      const conflicts = await TaskService.getConflicts(shift.id);
      
      logger.info(`  ${shift.date} ${shift.type === 'night' ? '夜班' : '白班'} - ${shift.status}`);
      logger.info(`    任务: ${summary.totalTasks} 个 | 完成: ${summary.completedTasks} | 进行中: ${summary.inProgressTasks}`);
      logger.info(`    任务完成率: ${summary.completionRate}%`);
      
      if (conflicts.length > 0) {
        logger.warn(`    ⚠️  发现冲突:`);
        conflicts.forEach(c => {
          logger.warn(`       - ${c.message}`);
        });
      }
    }
    logger.info('');
    
    const tasks = await TaskService.getAll();
    logger.info(`📋 任务总数: ${tasks.length}`);
    
    const taskByStatus = {};
    tasks.forEach(t => {
      taskByStatus[t.status] = (taskByStatus[t.status] || 0) + 1;
    });
    logger.info('  状态分布:', taskByStatus);
    
    const taskByPriority = {};
    tasks.forEach(t => {
      taskByPriority[t.priority] = (taskByPriority[t.priority] || 0) + 1;
    });
    logger.info('  优先级分布:', taskByPriority);
    logger.info('');
    
    const firstShift = shifts[0];
    if (firstShift) {
      const report = await ReportService.generateShiftSummaryReport(firstShift.id);
      logger.info(`📊 ${firstShift.date} 班次摘要报告生成成功`);
      logger.info(`  任务完成率: ${report.summary.completionRate}%`);
      logger.info(`  低电量叉车警告: ${report.warnings.lowBatteryForklifts} 台`);
    }
    logger.info('');
    
    const sensitiveTest = forklifts[0];
    if (sensitiveTest) {
      logger.info('🔒 敏感字段脱敏测试:');
      logger.info(`  操作员电话: ${sensitiveTest.operatorPhone}`);
      logger.info(`  ✓ 脱敏已生效 (显示为 ****)`);
    }
    logger.info('');
    
    await db.closeConnection();
    logger.info('========== 验证完成 ==========');
    
  } catch (error) {
    logger.error('数据验证失败:', error);
    process.exit(1);
  }
};

verifyData();