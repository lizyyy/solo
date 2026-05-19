const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../config/database');
const ImportService = require('../services/importService');

const importService = new ImportService();

const SAMPLE_DATA_DIR = path.join(__dirname, '../../sample_data');

async function importAllData() {
  console.log('开始导入样例数据...\n');

  try {
    console.log('1. 导入司机数据...');
    const driverResult = await importService.importBaseData(
      path.join(SAMPLE_DATA_DIR, 'drivers.csv'),
      'driver',
      'admin'
    );
    console.log(`   司机数据导入完成: ${driverResult.successCount}/${driverResult.total} 成功\n`);

    console.log('2. 导入车辆数据...');
    const busResult = await importService.importBaseData(
      path.join(SAMPLE_DATA_DIR, 'buses.csv'),
      'bus',
      'admin'
    );
    console.log(`   车辆数据导入完成: ${busResult.successCount}/${busResult.total} 成功\n`);

    console.log('3. 导入学生数据...');
    const studentResult = await importService.importBaseData(
      path.join(SAMPLE_DATA_DIR, 'students.csv'),
      'student',
      'admin'
    );
    console.log(`   学生数据导入完成: ${studentResult.successCount}/${studentResult.total} 成功\n`);

    console.log('4. 导入司机打卡数据...');
    const checkinResult = await importService.importDriverCheckins(
      path.join(SAMPLE_DATA_DIR, 'checkins.csv'),
      'admin'
    );
    console.log(`   打卡数据导入完成: ${checkinResult.successCount}/${checkinResult.total} 成功\n`);

    console.log('5. 导入GPS轨迹数据...');
    const gpsResult = await importService.importGpsTracks(
      path.join(SAMPLE_DATA_DIR, 'gps_tracks.csv'),
      'admin'
    );
    console.log(`   GPS数据导入完成: ${gpsResult.successCount}/${gpsResult.total} 成功\n`);

    console.log('6. 导入家长申诉数据...');
    const complaintResult = await importService.importParentComplaints(
      path.join(SAMPLE_DATA_DIR, 'complaints.csv'),
      'admin'
    );
    console.log(`   申诉数据导入完成: ${complaintResult.successCount}/${complaintResult.total} 成功\n`);

    console.log('='.repeat(50));
    console.log('所有样例数据导入完成！');
    console.log('='.repeat(50));
    console.log('\n数据统计:');
    console.log(`- 司机: ${driverResult.successCount} 人`);
    console.log(`- 车辆: ${busResult.successCount} 辆`);
    console.log(`- 学生: ${studentResult.successCount} 人`);
    console.log(`- 打卡记录: ${checkinResult.successCount} 条`);
    console.log(`- GPS轨迹: ${gpsResult.successCount} 条`);
    console.log(`- 家长申诉: ${complaintResult.successCount} 条`);

  } catch (error) {
    console.error('数据导入失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => importAllData())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化失败:', error);
      process.exit(1);
    });
}

module.exports = { importAllData };