const { initDB, runQuery, STATUS } = require('../src/db');
const meterService = require('../src/services/meterService');
const dayjs = require('dayjs');

async function seed() {
  await initDB();
  console.log('开始生成测试数据...');

  console.log('1. 创建电表数据...');
  const meter1 = await meterService.createMeter({
    meter_no: 'METER-001',
    meter_name: 'A栋1楼总电表',
    location: 'A栋1楼配电室'
  });
  console.log('   - 电表1:', meter1.meter_no);

  const meter2 = await meterService.createMeter({
    meter_no: 'METER-002',
    meter_name: 'B栋2楼总电表',
    location: 'B栋2楼配电室'
  });
  console.log('   - 电表2:', meter2.meter_no);

  const meter3 = await meterService.createMeter({
    meter_no: 'METER-003',
    meter_name: 'C栋3楼总电表',
    location: 'C栋3楼配电室'
  });
  console.log('   - 电表3:', meter3.meter_no);

  console.log('2. 生成正常读数序列 (完整流转)...');
  let reading1 = await meterService.addReading(
    meter1.id,
    1000.0,
    dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '张三'
  );
  console.log('   - 读数1: 1000.0 (正常)');

  let reading2 = await meterService.addReading(
    meter1.id,
    1150.5,
    dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '张三'
  );
  console.log('   - 读数2: 1150.5 (正常)');

  let reading3 = await meterService.addReading(
    meter1.id,
    1280.3,
    dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '张三'
  );
  console.log('   - 读数3: 1280.3 (正常)');

  let reading4 = await meterService.addReading(
    meter1.id,
    1420.8,
    dayjs().format('YYYY-MM-DD HH:mm:ss'),
    '张三'
  );
  console.log('   - 读数4: 1420.8 (正常)');

  console.log('3. 生成读数倒挂异常 (冲突记录)...');
  let abnormalReading1 = await meterService.addReading(
    meter2.id,
    2000.0,
    dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '李四'
  );
  console.log('   - 正常读数: 2000.0');

  let abnormalReading2 = await meterService.addReading(
    meter2.id,
    1850.0,
    dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '李四'
  );
  console.log('   - 异常读数(倒挂): 1850.0');
  console.log('   - 生成复核记录ID:', abnormalReading2.review?.id);
  console.log('   - 异常状态:', abnormalReading2.review?.status);
  console.log('   - 异常说明:', abnormalReading2.review?.anomaly_detail);

  console.log('4. 模拟换表后读数倒挂 (待人工处理)...');
  await meterService.addReading(
    meter3.id,
    5000.0,
    dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '王五'
  );
  console.log('   - 旧表读数: 5000.0');

  const newMeter3 = await meterService.replaceMeter('METER-003', {
    meter_no: 'METER-003-NEW',
    meter_name: 'C栋3楼总电表(新)',
    location: 'C栋3楼配电室'
  });
  console.log('   - 换表完成, 新表号:', newMeter3.meter_no);

  const newMeterReading = await meterService.addReading(
    newMeter3.id,
    100.0,
    dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '王五'
  );
  console.log('   - 新表读数(倒挂): 100.0');
  console.log('   - 生成复核记录ID:', newMeterReading.review?.id);
  console.log('   - 待人工处理状态:', newMeterReading.review?.status);
  console.log('   - 可解释原因:', newMeterReading.review?.anomaly_detail);

  console.log('5. 创建导入用的 CSV 坏行示例...');
  const fs = require('fs');
  const path = require('path');
  
  const csvContent = `meter_no,meter_name,location,reading_value,reading_time,collector
METER-004,D栋1楼电表,D栋1楼,3000.0,2024-01-15 08:00:00,赵六
METER-005,D栋2楼电表,D栋2楼,3200.5,2024-01-15 08:00:00,赵六
METER-006,,,3100.0,2024-01-15 08:00:00,赵六
,,E栋1楼,,2024-01-15 08:00:00,赵六
METER-007,E栋2楼电表,E栋2楼,3500.0,2024-01-15 08:00:00,赵六
`;

  const csvPath = path.join(__dirname, '../test-import.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('   - 测试CSV已生成:', csvPath);
  console.log('   - 包含5行数据, 第4行缺少必填字段(坏行)');

  console.log('6. 演示复核状态流转...');
  if (abnormalReading2.review) {
    const correctedReview = await meterService.updateReviewStatus(
      abnormalReading2.review.id,
      STATUS.CORRECTED,
      '已核实为抄表错误，实际读数应为2180.0',
      '审核员A'
    );
    console.log('   - 状态流转: 异常待查 -> 已修正');
    console.log('   - 复核说明:', correctedReview.review_note);

    const confirmedReview = await meterService.updateReviewStatus(
      abnormalReading2.review.id,
      STATUS.CONFIRMED,
      '复核通过，数据已更正',
      '审核员B'
    );
    console.log('   - 状态流转: 已修正 -> 已确认');
    console.log('   - 复核说明:', confirmedReview.review_note);
  }

  console.log('');
  console.log('========================================');
  console.log('  测试数据生成完成!');
  console.log('========================================');
  console.log('');
  console.log('电表列表:');
  console.log('  - METER-001 (A栋1楼): 正常读数序列 x4');
  console.log('  - METER-002 (B栋2楼): 读数倒挂异常, 已完成状态流转');
  console.log('  - METER-003 (C栋3楼): 换表后倒挂, 待人工处理');
  console.log('  - METER-003-NEW (C栋3楼新表): 新换电表');
  console.log('');
  console.log('复核记录状态:');
  console.log('  - 异常待查 -> 已修正 -> 已确认 (完整流转演示)');
  console.log('  - 待人工处理 (换表倒挂特殊情况)');
  console.log('');
  console.log('导入测试:');
  console.log('  - test-import.csv 包含5行, 1行坏数据');
  console.log('');
}

seed().catch(console.error);
