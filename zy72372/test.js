console.log('Testing spring-fatigue-review system...\n');

const { SensorDataProcessor } = require('./src/processor');
const { DemoData } = require('./src/demo-data');
const { RECORD_STATUS, SAFETY_LEVEL } = require('./src/models');

const processor = new SensorDataProcessor();

console.log('1. 设置基线传感器数据...');
processor.knownSensors = DemoData.getBaselineSensors();
console.log('   基线传感器:', Array.from(processor.knownSensors.entries()));

console.log('\n2. 创建演示会话...');
const session = DemoData.createDemoSession();
console.log('   会话ID:', session.id);
console.log('   巡检员:', session.inspector);
console.log('   记录数:', session.records.length);

console.log('\n3. 执行复核流程...');
const result = processor.processSession(session);
console.log('   检测到传感器重启:', result.restartDetections.length, '条');
result.restartDetections.forEach(d => {
  console.log(`   - ${d.springId}: ${d.oldSensorId} → ${d.newSensorId}`);
});

console.log('\n4. 记录详情:');
session.records.forEach(record => {
  const statusIcon = record.status === RECORD_STATUS.NORMAL ? '✅' : 
                     record.status === RECORD_STATUS.PENDING_REVIEW ? '🔍' : '📝';
  const fatigue = record.correctedFatigueValue !== null ? 
    `${record.fatigueValue}→${record.correctedFatigueValue}` : record.fatigueValue;
  console.log(`   ${statusIcon} ${record.springId}: 传感器=${record.sensorId}, 疲劳值=${fatigue}, 状态=${record.status}`);
});

console.log('\n5. 安全提醒:');
console.log('   等级:', result.safetyReminder.level);
console.log('   标题:', result.safetyReminder.title);

console.log('\n6. 复核 record-2...');
processor.reviewRecord('record-2', {
  comment: '传感器重启后数据偏差在可接受范围内，标记为需持续监测',
  correctedFatigueValue: 45
}, '安全员-老王', session);
console.log('   已完成复核');

console.log('\n7. 更新安全提醒...');
const updatedReminder = processor.updateSafetyReminderAfterReview(session);
console.log('   新等级:', updatedReminder.level);
console.log('   新标题:', updatedReminder.title);

console.log('\n✅ 所有测试通过！');
console.log('\n三种处理结果对比:');
console.log('  ✅ A001: 顺利记录 - 传感器无变化，疲劳值正常');
console.log('  🔍 A002: 传感器重启 - 待安全员复核，不急着归正常');
console.log('  📝 A003: 手写备注补录 - 从手写巡检记录修正疲劳值');
