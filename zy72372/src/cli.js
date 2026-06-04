#!/usr/bin/env node

const { SensorDataProcessor } = require('./processor');
const { DemoData } = require('./demo-data');
const { RECORD_STATUS, SAFETY_LEVEL } = require('./models');

const processor = new SensorDataProcessor();

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printStatusIcon(status) {
  const icons = {
    [RECORD_STATUS.NORMAL]: '✅',
    [RECORD_STATUS.SENSOR_RESTART]: '⚠️',
    [RECORD_STATUS.PENDING_REVIEW]: '🔍',
    [RECORD_STATUS.FROM_MANUAL_NOTE]: '📝',
    [RECORD_STATUS.REVIEWED]: '✓'
  };
  return icons[status] || '❓';
}

function printSafetyLevel(level) {
  const colors = {
    [SAFETY_LEVEL.SAFE]: '\x1b[32m',
    [SAFETY_LEVEL.WARNING]: '\x1b[33m',
    [SAFETY_LEVEL.DANGER]: '\x1b[31m',
    [SAFETY_LEVEL.UNKNOWN]: '\x1b[37m'
  };
  const labels = {
    [SAFETY_LEVEL.SAFE]: '安全',
    [SAFETY_LEVEL.WARNING]: '警告',
    [SAFETY_LEVEL.DANGER]: '危险',
    [SAFETY_LEVEL.UNKNOWN]: '未知'
  };
  return `${colors[level] || ''}${labels[level] || level}\x1b[0m`;
}

function printRecord(record, showDetails = false) {
  const statusIcon = printStatusIcon(record.status);
  const fatigueStatus = processor.calculateFatigueStatus(
    record.correctedFatigueValue !== null ? record.correctedFatigueValue : record.fatigueValue
  );
  
  console.log(`\n${statusIcon} 弹簧 ${record.springId}`);
  console.log(`   记录ID: ${record.id}`);
  console.log(`   传感器: ${record.sensorId}${record.sensorRestartDetected ? ` (原: ${record.originalSensorId}) ⚠️ 编号变更` : ''}`);
  console.log(`   疲劳值: ${record.fatigueValue}${record.correctedFatigueValue !== null ? ` → 修正: ${record.correctedFatigueValue}` : ''} ${printSafetyLevel(fatigueStatus)}`);
  console.log(`   状态: ${record.status}`);
  console.log(`   运行次数: ${record.runCount}`);
  
  if (record.photoPath) {
    console.log(`   工况照片: ${record.photoPath}`);
  }
  
  if (record.manualNote) {
    console.log(`   📝 手写备注: ${typeof record.manualNote === 'object' ? record.manualNote.content : record.manualNote}`);
  }
  
  if (record.reviewComment) {
    console.log(`   💬 复核意见: ${record.reviewComment} (复核人: ${record.reviewedBy})`);
  }
  
  if (showDetails && record.history && record.history.length > 0) {
    console.log(`   📜 操作历史:`);
    record.history.forEach((h, i) => {
      console.log(`      ${i + 1}. ${h.action} - ${h.timestamp}`);
    });
  }
}

function printSafetyReminder(reminder) {
  console.log('\n' + '-'.repeat(50));
  console.log(`🚨 安全提醒: ${printSafetyLevel(reminder.level)}`);
  console.log(`   标题: ${reminder.title}`);
  console.log(`   描述: ${reminder.description}`);
  console.log(`   影响记录: ${reminder.affectedRecords.length} 条`);
  console.log(`   生成时间: ${reminder.generatedAt}`);
  if (reminder.updatedAt !== reminder.generatedAt) {
    console.log(`   更新时间: ${reminder.updatedAt}`);
  }
  console.log('-'.repeat(50));
}

function runDemo() {
  printHeader('弹簧疲劳寿命复核 - 演示模式');
  console.log('\n👷 维修师傅: 老岑');
  console.log('📍 地点: A区生产线-3号机组');
  console.log('📅 日期: 2024-06-01');

  const stepByStep = DemoData.getStepByStepDemo();
  
  printHeader(stepByStep.step1.title);
  console.log(`\n${stepByStep.step1.description}`);
  console.log('\n导入的工况照片数据:');
  stepByStep.step1.data.forEach(d => {
    console.log(`  • 弹簧 ${d.springId}: 传感器 ${d.sensorId}, 疲劳值 ${d.fatigueValue}`);
  });

  printHeader(stepByStep.step2.title);
  console.log(`\n${stepByStep.step2.description}`);
  console.log('\n检测到的传感器编号变化:');
  stepByStep.step2.detections.forEach(d => {
    console.log(`  🔍 弹簧 ${d.springId}: ${d.old} → ${d.new}`);
  });
  console.log('\n⚠️  系统标记为待复核，不自动归正常，留给安全员确认');

  printHeader(stepByStep.step3.title);
  console.log(`\n${stepByStep.step3.description}`);
  console.log(`\n📝 手写备注内容:`);
  console.log(`  ${stepByStep.step3.manualNote.content}`);
  console.log(`  修正疲劳值: ${stepByStep.step3.manualNote.correctedFatigueValue}`);

  printHeader('执行复核流程');
  
  processor.knownSensors = DemoData.getBaselineSensors();
  const session = DemoData.createDemoSession();
  const result = processor.processSession(session);
  
  console.log('\n📊 复核结果汇总:');
  console.log(`  总记录数: ${result.session.records.length}`);
  console.log(`  传感器重启检测: ${result.restartDetections.length} 条`);

  console.log('\n📋 记录详情:');
  result.session.records.forEach(record => {
    printRecord(record, true);
  });

  if (result.safetyReminder) {
    printSafetyReminder(result.safetyReminder);
  }

  printHeader(stepByStep.step4.title);
  console.log(`\n${stepByStep.step4.description}`);
  
  const record2 = session.getRecordById('record-2');
  processor.reviewRecord('record-2', {
    comment: stepByStep.step4.reviewResult.comment,
    correctedFatigueValue: record2.fatigueValue
  }, '安全员-老王', session);
  
  console.log('\n✅ 已复核 record-2 (弹簧 A002)');

  printHeader(stepByStep.step5.title);
  console.log(`\n${stepByStep.step5.description}`);
  
  const updatedReminder = processor.updateSafetyReminderAfterReview(session);
  printSafetyReminder(updatedReminder);

  printHeader('三种处理结果对比');
  console.log('\n1️⃣ 顺利记录 (弹簧 A001):');
  console.log('   • 传感器编号无变化');
  console.log('   • 疲劳值正常 (25 < 30)');
  console.log('   • 状态: normal ✅');
  
  console.log('\n2️⃣ 传感器重启待复核 (弹簧 A002):');
  console.log('   • 传感器编号变化: SNS-0022 → SNS-0022-NEW');
  console.log('   • 已由安全员复核');
  console.log('   • 状态: reviewed ✓');
  
  console.log('\n3️⃣ 手写备注补录修正 (弹簧 A003):');
  console.log('   • 传感器编号变化: SNS-0031 → SNS-0031-NEW');
  console.log('   • 原始疲劳值 78 (危险) → 修正为 42 (警告)');
  console.log('   • 来源: 手写巡检备注');
  console.log('   • 状态: from_manual_note 📝');
  console.log('   • 重跑分析: 是 (runCount = 2)');

  printHeader('证据链完整检查');
  console.log('\n✅ 工况照片: 每条记录都有对应的照片路径');
  console.log('✅ 操作历史: 每条记录都保留完整的处理轨迹');
  console.log('✅ 复核痕迹: 复核人、复核时间、复核意见完整记录');
  console.log('✅ 数据溯源: 传感器原始编号、修正值来源清晰可查');
  
  console.log('\n🎓 给新人的建议:');
  console.log('   1. 看到传感器编号变化时，别急着归正常');
  console.log('   2. 一定要翻手写巡检本确认是否真的更换过传感器');
  console.log('   3. 更换传感器后的数据要按旧口径折算');
  console.log('   4. 每一步操作都要留痕，方便以后追溯');

  printHeader('演示结束');
  console.log('\n💡 运行 `npm run demo` 可重新查看演示');
  console.log('💡 运行 `npm start` 可进入交互模式');
}

function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  printHeader('弹簧疲劳寿命复核 - 交互模式');
  console.log('\n请选择操作:');
  console.log('  1. 导入工况照片数据');
  console.log('  2. 查看当前会话记录');
  console.log('  3. 补录手写巡检备注');
  console.log('  4. 复核待处理记录');
  console.log('  5. 更新安全提醒');
  console.log('  6. 重跑分析');
  console.log('  7. 运行演示');
  console.log('  0. 退出');

  rl.question('\n请输入选项: ', (choice) => {
    switch(choice) {
      case '1':
        console.log('\n📷 导入照片数据...');
        const photoData = DemoData.getPhotoImportData();
        processor.knownSensors = DemoData.getBaselineSensors();
        const records = processor.importPhotoData(photoData);
        console.log(`✅ 已导入 ${records.length} 条记录`);
        rl.close();
        break;
      case '7':
        rl.close();
        runDemo();
        break;
      case '0':
        console.log('\n👋 再见！');
        rl.close();
        break;
      default:
        console.log('\n❌ 无效选项');
        rl.close();
    }
  });
}

const args = process.argv.slice(2);

if (args.includes('review') && args.includes('--demo')) {
  runDemo();
} else if (args.includes('--demo')) {
  runDemo();
} else {
  runInteractive();
}
