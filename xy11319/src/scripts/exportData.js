const { initDatabase } = require('../config/database');
const ExportService = require('../services/exportService');

const exportService = new ExportService();

async function exportData(type, options = {}) {
  console.log(`开始导出: ${type}...\n`);

  try {
    let result;

    switch (type) {
      case 'reconciliation':
        result = await exportService.exportReconciliations(options, 'cli_export');
        break;
      case 'complaint':
        result = await exportService.exportComplaints(options, 'cli_export');
        break;
      case 'checkin':
        if (!options.startDate || !options.endDate) {
          throw new Error('checkin导出需要提供 startDate 和 endDate 参数');
        }
        result = await exportService.exportDriverCheckins(options.startDate, options.endDate, 'cli_export');
        break;
      case 'gps':
        if (!options.busId || !options.date) {
          throw new Error('GPS导出需要提供 busId 和 date 参数');
        }
        result = await exportService.exportGpsTracks(options.busId, options.date, 'cli_export');
        break;
      default:
        throw new Error(`不支持的导出类型: ${type}. 支持的类型: reconciliation, complaint, checkin, gps`);
    }

    console.log('✅ 导出成功！');
    console.log(`📄 文件名: ${result.filename}`);
    console.log(`📊 记录数: ${result.recordCount}`);
    console.log(`📁 路径: ${result.filePath}`);

    return result;
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
    throw error;
  }
}

async function listExports() {
  console.log('导出文件列表:\n');
  const files = await exportService.getExportList();
  
  if (files.length === 0) {
    console.log('暂无导出文件');
    return;
  }

  files.forEach((file, i) => {
    const sizeKB = (file.size / 1024).toFixed(2);
    console.log(`${i + 1}. ${file.filename} (${sizeKB} KB) - ${file.created_at.toLocaleString()}`);
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  initDatabase()
    .then(async () => {
      if (command === 'list') {
        await listExports();
      } else if (command === 'reconciliation') {
        await exportData('reconciliation');
      } else if (command === 'complaint') {
        await exportData('complaint');
      } else if (command === 'checkin') {
        const startDate = args[1] || '2026-05-01';
        const endDate = args[2] || '2026-05-31';
        await exportData('checkin', { startDate, endDate });
      } else if (command === 'gps') {
        const busId = args[1] || 'BUS001';
        const date = args[2] || '2026-05-18';
        await exportData('gps', { busId, date });
      } else if (command === 'all') {
        await exportData('reconciliation');
        console.log();
        await exportData('complaint');
        console.log();
        await exportData('checkin', { startDate: '2026-05-01', endDate: '2026-05-31' });
      } else {
        console.log('使用方法:');
        console.log('  node src/scripts/exportData.js list                    # 列出所有导出文件');
        console.log('  node src/scripts/exportData.js reconciliation          # 导出对账记录');
        console.log('  node src/scripts/exportData.js complaint               # 导出申诉记录');
        console.log('  node src/scripts/exportData.js checkin [start] [end]   # 导出打卡记录');
        console.log('  node src/scripts/exportData.js gps [busId] [date]      # 导出GPS轨迹');
        console.log('  node src/scripts/exportData.js all                     # 导出所有数据');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('初始化失败:', error);
      process.exit(1);
    });
}

module.exports = { exportData, listExports };