const db = require('../src/database');
const ReportService = require('../src/services/report.service');
const ShiftService = require('../src/services/shift.service');
const logger = require('../src/utils/logger');

const exportAll = async () => {
  try {
    logger.info('开始导出数据...');
    logger.info('');
    
    await db.initTables();
    
    const shifts = await ShiftService.getAll();
    
    for (const shift of shifts) {
      logger.info(`导出班次 ${shift.date} 任务数据...`);
      const csv = await ReportService.exportShiftTasks(shift.id, 'csv');
      const filename = `shift-${shift.date}-${shift.type}.csv`;
      ReportService.saveToFile(csv, filename);
      logger.info(`✓ 已保存: exports/${filename}`);
    }
    
    logger.info('导出叉车状态...');
    const forkliftCsv = await ReportService.exportForkliftStatus('csv');
    ReportService.saveToFile(forkliftCsv, 'forklift-status.csv');
    logger.info('✓ 已保存: exports/forklift-status.csv');
    
    logger.info('导出充电桩状态...');
    const stationCsv = await ReportService.exportChargingStatus('csv');
    ReportService.saveToFile(stationCsv, 'charging-status.csv');
    logger.info('✓ 已保存: exports/charging-status.csv');
    
    logger.info('导出操作历史...');
    const historyCsv = await ReportService.exportHistoryLogs(null, null, null, 'csv');
    ReportService.saveToFile(historyCsv, 'operation-history.csv');
    logger.info('✓ 已保存: exports/operation-history.csv');
    
    await db.closeConnection();
    logger.info('');
    logger.info('✓ 所有数据导出完成！');
    logger.info('📂 导出文件位于 exports/ 目录');
    
  } catch (error) {
    logger.error('数据导出失败:', error);
    process.exit(1);
  }
};

exportAll();