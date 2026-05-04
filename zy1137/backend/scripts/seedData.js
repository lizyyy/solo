const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');
const DataImporter = require('../services/dataImporter');
const RiskAnalyzer = require('../services/riskAnalyzer');

const SAMPLE_DATA_DIR = path.join(__dirname, '../../sample-data');

const sampleFiles = {
  zones: path.join(SAMPLE_DATA_DIR, 'zones.json'),
  devices: path.join(SAMPLE_DATA_DIR, 'devices.csv'),
  bleScans: path.join(SAMPLE_DATA_DIR, 'ble-scans.jsonl'),
  pairingEvents: path.join(SAMPLE_DATA_DIR, 'pairing-events.csv')
};

async function seedDatabase() {
  console.log('='.repeat(60));
  console.log('蓝牙巡检工具 - 种子数据导入');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('1. 连接数据库...');
    await sequelize.authenticate();
    console.log('   ✓ 数据库连接成功');
    console.log('');

    console.log('2. 同步数据库模型...');
    await sequelize.sync({ force: true });
    console.log('   ✓ 数据库同步完成（已重置）');
    console.log('');

    const importer = new DataImporter();
    const results = {};

    if (fs.existsSync(sampleFiles.zones)) {
      console.log('3. 导入区域数据...');
      const zoneBuffer = fs.readFileSync(sampleFiles.zones);
      results.zones = await importer.importZones(zoneBuffer);
      console.log(`   ✓ 区域数据: ${results.zones.created} 条新建, ${results.zones.updated} 条更新`);
      if (results.zones.errors.length > 0) {
        console.log(`   ⚠  错误: ${results.zones.errors.length} 条`);
      }
    } else {
      console.log('3. 跳过区域数据导入（文件不存在）');
    }
    console.log('');

    if (fs.existsSync(sampleFiles.devices)) {
      console.log('4. 导入设备台账...');
      const deviceBuffer = fs.readFileSync(sampleFiles.devices);
      results.devices = await importer.importDevices(deviceBuffer);
      console.log(`   ✓ 设备数据: ${results.devices.created} 条新建, ${results.devices.updated} 条更新`);
      if (results.devices.errors.length > 0) {
        console.log(`   ⚠  错误: ${results.devices.errors.length} 条`);
      }
    } else {
      console.log('4. 跳过设备台账导入（文件不存在）');
    }
    console.log('');

    if (fs.existsSync(sampleFiles.bleScans)) {
      console.log('5. 导入扫描记录...');
      const scanBuffer = fs.readFileSync(sampleFiles.bleScans);
      results.bleScans = await importer.importBleScans(scanBuffer);
      console.log(`   ✓ 扫描记录: ${results.bleScans.created} 条新建, ${results.bleScans.skipped} 条跳过`);
      if (results.bleScans.errors.length > 0) {
        console.log(`   ⚠  错误: ${results.bleScans.errors.length} 条`);
      }
    } else {
      console.log('5. 跳过扫描记录导入（文件不存在）');
    }
    console.log('');

    if (fs.existsSync(sampleFiles.pairingEvents)) {
      console.log('6. 导入配对事件...');
      const pairingBuffer = fs.readFileSync(sampleFiles.pairingEvents);
      results.pairingEvents = await importer.importPairingEvents(pairingBuffer);
      console.log(`   ✓ 配对事件: ${results.pairingEvents.created} 条新建, ${results.pairingEvents.skipped} 条跳过`);
      if (results.pairingEvents.errors.length > 0) {
        console.log(`   ⚠  错误: ${results.pairingEvents.errors.length} 条`);
      }
    } else {
      console.log('6. 跳过配对事件导入（文件不存在）');
    }
    console.log('');

    console.log('7. 运行风险分析...');
    const analyzer = new RiskAnalyzer();
    
    const deviceAnalysis = await analyzer.analyzeAllDevices({ force: true });
    console.log(`   ✓ 设备分析完成: ${deviceAnalysis.devicesAnalyzed} 台设备, ${deviceAnalysis.anomaliesCreated} 条异常`);
    
    const randomAddressResult = await analyzer.detectRandomAddressDrift();
    if (randomAddressResult.detected) {
      console.log(`   ✓ 检测到随机地址漂移: ${randomAddressResult.groups.length} 组`);
    }

    const duplicateResult = await analyzer.detectDuplicateDevices();
    if (duplicateResult.detected) {
      console.log(`   ✓ 检测到重复设备: ${duplicateResult.duplicates.length} 组`);
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('导入完成！');
    console.log('='.repeat(60));
    console.log('');
    console.log('导入统计:');
    console.log(`  - 区域: ${(results.zones?.created || 0)} 条`);
    console.log(`  - 设备: ${(results.devices?.created || 0)} 条`);
    console.log(`  - 扫描记录: ${(results.bleScans?.created || 0)} 条`);
    console.log(`  - 配对事件: ${(results.pairingEvents?.created || 0)} 条`);
    console.log(`  - 检测到异常: ${deviceAnalysis.anomaliesCreated} 条`);
    console.log('');
    console.log('异常样例:');
    console.log('  1. RSSI信号抖动: 打印机-收银台1 (波动超过40dBm)');
    console.log('  2. 弱信号: ESL-货架A2-零食区 (平均 RSSI < -85 dBm)');
    console.log('  3. 低电量: ESL-货架C1-生鲜区 (5%)、Beacon-仓库入口 (8%)');
    console.log('  4. 长时间失联: ESL-货架B1-饮料区 (最后扫描: 2天前)');
    console.log('  5. 配对失败过多: 打印机-收银台1 (3次失败)');
    console.log('  6. 随机地址漂移: 检测到相似MAC地址');
    console.log('');
    console.log('提示: 启动后端服务后，可以通过 http://localhost:3000 访问系统');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ 种子数据导入失败:');
    console.error('   ' + error.message);
    console.error('');
    console.error('堆栈:');
    console.error(error.stack);
    process.exit(1);
  }
}

seedDatabase();
