#!/usr/bin/env node

const readline = require('readline');
const { SensorDataProcessor } = require('./processor');
const { DemoData } = require('./demo-data');
const { RECORD_STATUS, SAFETY_LEVEL, InspectionSession } = require('./models');

let processor = new SensorDataProcessor();
let currentSession = null;

function printHeader(title) {
  console.log('\n' + '='.repeat(64));
  console.log(`  ${title}`);
  console.log('='.repeat(64));
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

function statusLabel(status) {
  return {
    [RECORD_STATUS.NORMAL]: '正常',
    [RECORD_STATUS.PENDING_REVIEW]: '待复核',
    [RECORD_STATUS.FROM_MANUAL_NOTE]: '手写补录',
    [RECORD_STATUS.REVIEWED]: '已复核',
    [RECORD_STATUS.SENSOR_RESTART]: '传感器重启'
  }[status] || status;
}

function statusIcon(status) {
  return {
    [RECORD_STATUS.NORMAL]: '✅',
    [RECORD_STATUS.PENDING_REVIEW]: '🔍',
    [RECORD_STATUS.FROM_MANUAL_NOTE]: '📝',
    [RECORD_STATUS.REVIEWED]: '✓ ',
    [RECORD_STATUS.SENSOR_RESTART]: '⚠️ '
  }[status] || '❓';
}

function fatigueColor(value) {
  if (value === null || value === undefined) return '\x1b[37m';
  if (value < 30) return '\x1b[32m';
  if (value < 60) return '\x1b[33m';
  return '\x1b[31m';
}

function printRecordList(records) {
  console.log('\n  ' + '-'.repeat(60));
  console.log('  编号  弹簧    传感器                疲劳值       状态');
  console.log('  ' + '-'.repeat(60));
  records.forEach((r, idx) => {
    const display = r.correctedFatigueValue !== null
      ? `${r.fatigueValue} → ${r.correctedFatigueValue}`
      : `${r.fatigueValue}`;
    const color = fatigueColor(
      r.correctedFatigueValue !== null ? r.correctedFatigueValue : r.fatigueValue
    );
    const restartMark = r.sensorRestartDetected ? ' ⚠️变号' : '';
    const pad = str => String(str).padEnd(18, ' ');
    console.log(
      `  ${String(idx + 1).padEnd(4, ' ')}` +
      ` ${r.springId.padEnd(6, ' ')}` +
      ` ${pad(r.sensorId + restartMark)}` +
      ` ${color}${display.padEnd(12, ' ')}\x1b[0m` +
      ` ${statusIcon(r.status)} ${statusLabel(r.status)}`
    );
  });
  console.log('  ' + '-'.repeat(60));
}

function printSafetyReminder(reminder) {
  if (!reminder) {
    console.log('\n  ⚠️  暂无安全提醒');
    return;
  }
  console.log('\n  ' + '─'.repeat(58));
  console.log(`  🚨 安全提醒：${printSafetyLevel(reminder.level)}`);
  console.log(`  标题：${reminder.title}`);
  console.log(`  说明：${reminder.description.split('\n').join('\n        ')}`);
  if (reminder.updatedAt !== reminder.generatedAt) {
    console.log(`  更新时间：${reminder.updatedAt}`);
  }
  console.log('  ' + '─'.repeat(58));
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function stepImportPhotos() {
  printHeader('步骤 1/4：工况照片第一次导入');
  console.log('\n  📷 正在从现场工况照片提取OCR数据 ...');

  processor = new SensorDataProcessor();
  processor.knownSensors = DemoData.getBaselineSensors();

  const photoData = DemoData.getPhotoImportData();
  const records = processor.importPhotoData(photoData);

  currentSession = new InspectionSession({
    id: `session-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    inspector: '老岑',
    location: 'A区生产线-3号机组',
    photos: photoData.map((p, i) => ({
      id: `photo-${i + 1}`,
      path: p.path,
      description: `弹簧 ${p.springId} 工况照片`,
      timestamp: p.timestamp
    })),
    status: 'imported'
  });
  records.forEach(r => currentSession.addRecord(r.toJSON()));

  console.log(`\n  ✅ 共导入 ${records.length} 条工况照片记录`);
  printRecordList(currentSession.records);

  console.log('\n  🔎 开始检测传感器编号变化 ...');
  const result = processor.processSession(currentSession);
  if (result.restartDetections.length > 0) {
    console.log(`\n  ⚠️  检测到 ${result.restartDetections.length} 条传感器编号变化`);
    result.restartDetections.forEach(d => {
      console.log(`     • 弹簧 ${d.springId}：${d.oldSensorId} → ${d.newSensorId}`);
    });
    console.log('     → 已标记为「待复核」，暂时不归正常，留给安全员确认');
  } else {
    console.log('\n  ✅ 未检测到传感器编号变化');
  }

  printRecordList(currentSession.records);
  printSafetyReminder(currentSession.safetyReminder);

  console.log('\n  💡 下一步：在菜单中选 [3] 补录手写巡检备注');
}

async function stepApplyManualNote() {
  if (!currentSession) {
    console.log('\n  ❌ 请先执行「1. 工况照片第一次导入」');
    return;
  }

  printHeader('步骤 2/4：补录手写巡检备注');

  const pending = currentSession.records.filter(
    r => r.status === RECORD_STATUS.PENDING_REVIEW || r.sensorRestartDetected
  );
  if (pending.length === 0) {
    console.log('\n  ✅ 没有待复核的记录，无需补录');
    return;
  }

  console.log('\n  📋 以下记录传感器编号变化，可选择一条补录手写巡检备注：');
  printRecordList(pending);

  const pickStr = await ask(`\n  选择要补录的记录编号 (1-${pending.length}，直接回车=跳过)：`);
  if (!pickStr.trim()) {
    console.log('  已跳过补录');
    return;
  }
  const pick = parseInt(pickStr, 10);
  if (isNaN(pick) || pick < 1 || pick > pending.length) {
    console.log('  ❌ 无效编号');
    return;
  }
  const target = pending[pick - 1];

  console.log(`\n  ┌─ 弹簧 ${target.springId} 补录信息`);
  const defaultContent =
    '5月28日手写记录：弹簧' + target.springId + '原传感器' +
    target.originalSensorId + '损坏，已更换新传感器' + target.sensorId +
    '，疲劳值按旧口径修正为42';
  const content = await ask(`  手写备注内容 [回车用默认]:\n  `) || defaultContent;

  const defaultCorrected = 42;
  const correctedStr = await ask(
    `  修正后疲劳值 [默认 ${defaultCorrected}]：`
  );
  const correctedValue = correctedStr.trim()
    ? parseInt(correctedStr, 10)
    : defaultCorrected;

  const defaultReason = '更换新传感器后按旧口径折算';
  const reason = await ask(`  修改原因 [默认: ${defaultReason}]：`) || defaultReason;

  console.log(`  └──────────────────────────────`);
  console.log(`\n  📝 改前 / 改后对比：`);
  console.log(`     改前备注：${target.manualNote ? (typeof target.manualNote === 'object' ? target.manualNote.content : target.manualNote) : '(无)'}`);
  console.log(`     改后备注：${content}`);
  console.log(`     疲劳值：${target.fatigueValue} → ${correctedValue}`);
  const oldLvl = processor.calculateFatigueStatus(target.fatigueValue);
  const newLvl = processor.calculateFatigueStatus(correctedValue);
  console.log(`     安全等级：${printSafetyLevel(oldLvl)} → ${printSafetyLevel(newLvl)}`);
  console.log(`     修改原因：${reason}`);

  const confirm = await ask('\n  确认补录？(y/N) ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('  已取消');
    return;
  }

  const result = processor.applyManualNote(
    target.id,
    { content, correctedFatigueValue: correctedValue, reason, author: '老岑' },
    currentSession
  );

  console.log(`\n  ✅ 补录完成`);
  console.log(`     状态：${statusLabel(result.record.status)}`);
  console.log(`\n  🔄 安全提醒已同步更新`);
  printSafetyReminder(result.safetyReminder);
}

async function stepReviewRecord() {
  if (!currentSession) {
    console.log('\n  ❌ 请先执行「1. 工况照片第一次导入」');
    return;
  }

  printHeader('步骤 3/4：安全员复核待处理记录');

  const pending = currentSession.records.filter(
    r => r.status === RECORD_STATUS.PENDING_REVIEW
  );
  if (pending.length === 0) {
    console.log('\n  ✅ 没有待复核记录');
    printRecordList(currentSession.records);
    printSafetyReminder(currentSession.safetyReminder);
    return;
  }

  console.log(`\n  📋 共 ${pending.length} 条记录待安全员复核：`);
  printRecordList(pending);

  const pickStr = await ask(`\n  选择记录编号 (1-${pending.length}，直接回车=跳过)：`);
  if (!pickStr.trim()) {
    console.log('  已跳过');
    return;
  }
  const pick = parseInt(pickStr, 10);
  if (isNaN(pick) || pick < 1 || pick > pending.length) {
    console.log('  ❌ 无效编号');
    return;
  }
  const target = pending[pick - 1];

  console.log(`\n  弹簧 ${target.springId} 当前情况：`);
  console.log(`     传感器编号变化：${target.originalSensorId} → ${target.sensorId}`);
  const fv = target.correctedFatigueValue !== null
    ? target.correctedFatigueValue : target.fatigueValue;
  console.log(`     当前疲劳值：${fv} (${printSafetyLevel(processor.calculateFatigueStatus(fv))})`);

  const defaultComment =
    '传感器重启后数据偏差在可接受范围内，标记为需持续监测';
  const comment = await ask(`\n  复核意见 [回车用默认]:\n  `) || defaultComment;

  const correctedStr = await ask(
    `  复核修正疲劳值 (直接回车用当前 ${fv})：`
  );
  const correctedValue = correctedStr.trim() ? parseInt(correctedStr, 10) : fv;
  const reviewer = (await ask('  复核人姓名 [默认 安全员-老王]：')) || '安全员-老王';

  console.log(`\n  📝 复核对比：`);
  console.log(`     疲劳值：${fv} → ${correctedValue}`);
  console.log(`     复核意见：${comment}`);
  console.log(`     复核人：${reviewer}`);

  const confirm = await ask('\n  确认复核完成？(y/N) ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('  已取消');
    return;
  }

  const result = processor.reviewRecord(
    target.id,
    { comment, correctedFatigueValue: correctedValue },
    reviewer,
    currentSession
  );

  console.log(`\n  ✅ 复核完成：弹簧 ${result.diff.springId} 已由 ${reviewer} 复核`);
  console.log(`\n  🔄 安全提醒已同步更新`);
  printSafetyReminder(result.safetyReminder);
}

async function stepRerun() {
  if (!currentSession) {
    console.log('\n  ❌ 请先执行「1. 工况照片第一次导入」');
    return;
  }

  printHeader('步骤 4/4：重跑分析');

  const before = currentSession.records.map(r => ({
    springId: r.springId,
    fatigue: r.correctedFatigueValue !== null ? r.correctedFatigueValue : r.fatigueValue,
    status: r.status,
    runCount: r.runCount
  }));

  const confirm = await ask(
    '\n  将对全部记录重跑分析，运行次数+1。确认重跑？(y/N) '
  );
  if (confirm.toLowerCase() !== 'y') {
    console.log('  已取消');
    return;
  }

  const result = processor.rerunAnalysis(currentSession);

  console.log(`\n  ✅ 重跑完成`);
  console.log(`  重跑前后对比：`);
  console.log('  ' + '-'.repeat(58));
  console.log('  弹簧    疲劳(前)→(后)  状态(前)→(后)  运行次数');
  console.log('  ' + '-'.repeat(58));
  result.session.records.forEach((r, i) => {
    const fAfter = r.correctedFatigueValue !== null
      ? r.correctedFatigueValue : r.fatigueValue;
    console.log(
      `  ${r.springId.padEnd(6, ' ')} ` +
      `${String(before[i].fatigue).padStart(6, ' ')} → ${String(fAfter).padEnd(6, ' ')} ` +
      `${statusLabel(before[i].status).padEnd(4, ' ')} → ${statusLabel(r.status).padEnd(4, ' ')} ` +
      `${before[i].runCount} → ${r.runCount}`
    );
  });
  console.log('  ' + '-'.repeat(58));

  printSafetyReminder(currentSession.safetyReminder);
}

function stepShowRecords() {
  if (!currentSession) {
    console.log('\n  ❌ 暂无数据，请先执行「1. 工况照片第一次导入」');
    return;
  }
  printHeader('当前会话记录总览');
  console.log(`\n  会话ID：${currentSession.id}`);
  console.log(`  巡检员：${currentSession.inspector}  地点：${currentSession.location}`);
  printRecordList(currentSession.records);
  printSafetyReminder(currentSession.safetyReminder);

  console.log('\n  📜 每条记录操作历史：');
  currentSession.records.forEach(r => {
    console.log(`\n  ${statusIcon(r.status)} 弹簧 ${r.springId} (${statusLabel(r.status)})`);
    console.log(`     传感器：${r.sensorId}` +
      (r.sensorRestartDetected ? `  (原 ${r.originalSensorId})` : ''));
    const fv = r.correctedFatigueValue !== null
      ? `${r.fatigueValue} → ${r.correctedFatigueValue}`
      : r.fatigueValue;
    console.log(`     疲劳值：${fv}   运行次数：${r.runCount}`);
    if (r.manualNote) {
      const n = typeof r.manualNote === 'object' ? r.manualNote : { content: r.manualNote };
      console.log(`     📝 手写备注：${n.content}`);
    }
    if (r.reviewComment) {
      console.log(`     💬 复核[${r.reviewedBy} @ ${r.reviewedAt}]：${r.reviewComment}`);
    }
    if (r.photoPath) console.log(`     📷 照片：${r.photoPath}`);
    console.log(`     操作轨迹：`);
    r.history.forEach((h, i) => {
      console.log(`       ${i + 1}. ${h.action}  ${h.timestamp}`);
      if (h.data && h.data.reason) console.log(`          原因：${h.data.reason}`);
    });
  });
}

function runQuickDemo() {
  printHeader('快速演示：完整链路一次性走通');
  const { execSync } = require('child_process');
  console.log(execSync('node test.js', { cwd: __dirname + '/..', encoding: 'utf8' }));
}

async function mainMenu() {
  while (true) {
    printHeader('弹簧疲劳寿命复核 · 主菜单');
    console.log(`\n  当前会话状态：${currentSession ? '已导入' : '未开始'}`);
    console.log('\n  ┌─────────────────────────────────────────────────────┐');
    console.log('  │  1. 工况照片第一次导入  (第一步必选)                 │');
    console.log('  │  2. 查看记录与证据链                                 │');
    console.log('  │  3. 补录手写巡检备注  (改备注+疲劳值+刷新安全提醒)  │');
    console.log('  │  4. 安全员复核待处理  (复核意见+刷新安全提醒)       │');
    console.log('  │  5. 重跑分析          (全量重算，运行次数+1)         │');
    console.log('  │  6. 运行快速演示      (一次跑完整流程)              │');
    console.log('  │  0. 退出                                              │');
    console.log('  └─────────────────────────────────────────────────────┘');

    const choice = await ask('\n  请输入选项 [0-6]：');

    switch (choice.trim()) {
      case '1': await stepImportPhotos(); break;
      case '2': stepShowRecords(); break;
      case '3': await stepApplyManualNote(); break;
      case '4': await stepReviewRecord(); break;
      case '5': await stepRerun(); break;
      case '6': runQuickDemo(); break;
      case '0':
        console.log('\n  👋 再见');
        return;
      default:
        console.log(
          `\n  ❌ 无效选项「${choice}」，请输入 0-6 之间的数字。` +
          `\n     提示：必须先选 [1] 导入工况照片，后续 3/4/5 才能操作。`
        );
    }
    await ask('\n  按回车返回菜单...');
  }
}

const args = process.argv.slice(2);

if (args.includes('--demo')) {
  runQuickDemo();
} else {
  mainMenu().catch(err => {
    console.error('  ❌ 程序异常：', err.message);
    process.exit(1);
  });
}
