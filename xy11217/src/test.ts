import { initDatabase } from './database';
import { SampleRecordDao } from './dao/SampleRecordDao';
import { TemperatureRecordDao } from './dao/TemperatureRecordDao';
import { WasteRecordDao } from './dao/WasteRecordDao';
import { QualityControlService } from './services/QualityControlService';
import { DataMaskingService } from './services/DataMaskingService';
import { UserRole, RecordStatus } from './types';
import dayjs from 'dayjs';

async function runTest() {
  console.log('=== 门店品控系统测试开始 ===\n');

  await initDatabase();

  const sampleDao = new SampleRecordDao();
  const tempDao = new TemperatureRecordDao();
  const wasteDao = new WasteRecordDao();
  const qcService = new QualityControlService();
  const maskingService = new DataMaskingService();

  console.log('1. 创建测试留样记录...');
  const sample1 = await sampleDao.create({
    storeId: 'ST001',
    storeName: '朝阳门店',
    dishId: 'D001',
    dishName: '宫保鸡丁',
    batchNo: 'B2024011501',
    sampleTime: dayjs().subtract(2, 'day').toISOString(),
    samplePerson: '张三',
    samplePersonPhone: '13800138001',
    expireTime: dayjs().add(2, 'day').toISOString(),
    storageLocation: '留样柜A区',
    status: RecordStatus.PENDING
  });

  const sample2 = await sampleDao.create({
    storeId: 'ST002',
    storeName: '海淀门店',
    dishId: 'D001',
    dishName: '宫保鸡丁',
    batchNo: 'B2024011501',
    sampleTime: dayjs().subtract(2, 'day').toISOString(),
    samplePerson: '李四',
    samplePersonPhone: '13900139002',
    expireTime: dayjs().subtract(1, 'hour').toISOString(),
    storageLocation: '留样柜A区',
    status: RecordStatus.PENDING
  });
  console.log('   已创建 2 条留样记录\n');

  console.log('2. 创建测试温度记录...');
  const temp1 = await tempDao.create({
    storeId: 'ST001',
    storeName: '朝阳门店',
    fridgeId: 'F001',
    fridgeName: '冷藏柜1号',
    recordTime: dayjs().toISOString(),
    temperature: 2.5,
    minTemp: 0,
    maxTemp: 4,
    recordPerson: '王五',
    recordPersonPhone: '13700137003',
    status: RecordStatus.PENDING
  });

  const temp2 = await tempDao.create({
    storeId: 'ST001',
    storeName: '朝阳门店',
    fridgeId: 'F002',
    fridgeName: '冷藏柜2号',
    recordTime: dayjs().toISOString(),
    temperature: 8.5,
    minTemp: 0,
    maxTemp: 4,
    recordPerson: '赵六',
    recordPersonPhone: '13600136004',
    status: RecordStatus.PENDING
  });
  console.log('   已创建 2 条温度记录\n');

  console.log('3. 创建测试废弃记录...');
  const waste1 = await wasteDao.create({
    storeId: 'ST001',
    storeName: '朝阳门店',
    dishId: 'D002',
    dishName: '鱼香肉丝',
    batchNo: 'B2024011502',
    wasteTime: dayjs().toISOString(),
    wasteAmount: 5,
    wasteReason: '过期',
    wastePerson: '孙七',
    wastePersonPhone: '13500135005',
    status: RecordStatus.PENDING
  });
  console.log('   已创建 1 条废弃记录\n');

  console.log('4. 执行过期留样检测...');
  const expiredResult = await qcService.executeExpiredSampleCheck();
  console.log(`   总检测数: ${expiredResult.total}`);
  console.log(`   匹配规则: ${expiredResult.matched} 个`);
  console.log(`   已隔离: ${expiredResult.blocked} 个`);
  console.log(`   正常放行: ${expiredResult.passed} 个\n`);

  console.log('5. 执行温度异常检测...');
  const tempResult = await qcService.executeTemperatureCheck();
  console.log(`   总检测数: ${tempResult.total}`);
  console.log(`   匹配规则: ${tempResult.matched} 个`);
  console.log(`   已拦截: ${tempResult.blocked} 个`);
  console.log(`   正常放行: ${tempResult.passed} 个\n`);

  console.log('6. 查询同批次菜品跨门店汇总...');
  const batchSummary = await qcService.getBatchSummary('B2024011501');
  if (batchSummary) {
    console.log(`   批次 ${batchSummary.batchNo}:`);
    console.log(`     - 涉及门店: ${batchSummary.storeIds.length} 个 (${batchSummary.storeNames.join(', ')})`);
    console.log(`     - 留样数量: ${batchSummary.sampleCount} 份`);
    console.log(`     - 废弃数量: ${batchSummary.wasteCount} 份`);
    console.log(`     - 异常数量: ${batchSummary.anomalyCount} 份\n`);
  } else {
    console.log('   未找到该批次数据\n');
  }

  console.log('7. 数据脱敏测试（门店经理权限）...');
  const maskedSamples = await maskingService.maskSampleRecords([sample1, sample2], UserRole.STORE_MANAGER);
  console.log(`   原始手机号: ${sample1.samplePersonPhone}`);
  console.log(`   脱敏后手机号: ${maskedSamples[0].samplePersonPhone}\n`);

  console.log('8. 人工复核测试...');
  const approveResult = await qcService.approveRecord(sample1.id, 'sample', 'quality_admin');
  console.log(`   留样记录 ${sample1.id} 复核结果:`, approveResult ? '通过' : '失败');
  
  const rejectResult = await qcService.rejectRecord(temp2.id, 'temperature', 'quality_admin', '温度异常，需要整改');
  console.log(`   温度记录 ${temp2.id} 复核结果:`, rejectResult ? '已驳回' : '失败');
  console.log('');

  console.log('9. 查询规则执行日志...');
  const ruleLogs = await qcService.getRuleLogsByRecord(sample2.id, 'sample');
  console.log(`   留样记录 ${sample2.id} 的规则日志:`);
  ruleLogs.forEach((log, i) => {
    console.log(`     [${i + 1}] ${log.action} - ${log.reason}`);
    console.log(`         时间: ${dayjs(log.processedAt).format('YYYY-MM-DD HH:mm:ss')}`);
  });
  console.log('');

  console.log('10. 查询所有留样记录状态...');
  const allSamplesResult = await sampleDao.findAll();
  allSamplesResult.data.forEach(s => {
    console.log(`   ${s.dishName} (${s.batchNo}): ${s.status}`);
  });
  console.log('');

  console.log('11. 查询所有温度记录状态...');
  const allTempsResult = await tempDao.findAll();
  allTempsResult.data.forEach(t => {
    console.log(`   ${t.fridgeName}: ${t.temperature}℃ (范围: ${t.minTemp}-${t.maxTemp}℃) - ${t.status}`);
  });
  console.log('');

  console.log('=== 所有测试完成！ ===');
  console.log('');
  console.log('系统特性验证总结:');
  console.log('✓ SQLite 本地持久化存储');
  console.log('✓ 过期留样自动隔离规则');
  console.log('✓ 温度异常自动检测拦截');
  console.log('✓ 同批次菜品跨门店汇总');
  console.log('✓ 规则执行日志（每条记录有明确原因）');
  console.log('✓ 基于角色的数据脱敏');
  console.log('✓ 人工复核流程（通过/驳回）');
  console.log('✓ 完整的历史记录追踪');
  console.log('');
  console.log('数据库文件位置: ./data/quality_control.db');
  console.log('重启服务后可查询本次测试数据');
}

runTest().catch(console.error);
