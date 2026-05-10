const chalk = require('chalk');
const { table, getBorderCharacters } = require('table');

const importer = require('../src/importer');
const storage = require('../src/storage');
const calculator = require('../src/calculator');
const printer = require('../src/printer');

function resetStorage() {
  storage.saveStudents([]);
  storage.saveSchedules([]);
  storage.saveAttendances([]);
  storage.saveLeaves([]);
  storage.saveMakeups([]);
  storage.saveTransfers([]);
  storage.saveCorrections([]);
}

function printSection(title) {
  console.log('\n' + chalk.bold.white.bgBlue(' ' + '═'.repeat(68) + ' '));
  console.log(chalk.bold.white.bgBlue('  ' + title.padEnd(66) + '  '));
  console.log(chalk.bold.white.bgBlue(' ' + '═'.repeat(68) + ' '));
}

function runScenario1_NormalDeduction() {
  printSection('场景1：正常扣课 + 重复签到去重');
  console.log(chalk.cyan('\n说明: 张三在英语A班上了2节课，其中1节课被重复导入。'));
  console.log(chalk.cyan('      重复签到应该只扣一次课时。'));
  console.log(chalk.cyan('      预期: 扣4课时 (2节课 × 2小时/节)，重复签到被忽略。'));

  resetStorage();

  storage.saveStudents([
    {
      id: 'STU_S001',
      studentId: 'S001',
      name: '张三',
      totalLessons: 50,
      usedLessons: 10,
      className: '英语A班',
      classId: 'ENG-A'
    }
  ]);

  storage.saveSchedules([
    {
      id: 'eng-a|2024-01-08|09:00',
      classId: 'ENG-A',
      className: '英语A班',
      lessonDate: '2024-01-08',
      startTime: '09:00',
      lessonHours: 2
    },
    {
      id: 'eng-a|2024-01-15|09:00',
      classId: 'ENG-A',
      className: '英语A班',
      lessonDate: '2024-01-15',
      startTime: '09:00',
      lessonHours: 2
    }
  ]);

  const attendanceRows = [
    {学生ID: 'S001', 班级ID: 'ENG-A', 上课日期: '2024-01-08', 开始时间: '09:00', 签到状态: '正常'},
    {学生ID: 'S001', 班级ID: 'ENG-A', 上课日期: '2024-01-08', 开始时间: '09:00', 签到状态: '正常'},
    {学生ID: 'S001', 班级ID: 'ENG-A', 上课日期: '2024-01-08', 开始时间: '09:00', 签到状态: '正常'},
    {学生ID: 'S001', 班级ID: 'ENG-A', 上课日期: '2024-01-15', 开始时间: '09:00', 签到状态: '正常'}
  ];
  
  const importResult = importer.importAttendances(attendanceRows, []);
  storage.saveAttendances(importResult.data);
  printer.printImportResults('签到记录', importResult.results);

  const data = storage.loadAll();
  const result = calculator.calculateConsumption(data);
  
  const zhangsan = result.students.find(s => s.studentId === 'S001');
  printer.printStudentDetail(zhangsan);

  console.log(chalk.bold('\n验证结果:'));
  const expectedConsumed = 4;
  const expectedRemaining = 50 - 10 - 4;
  const actualConsumed = zhangsan.periodConsumed;
  const actualRemaining = zhangsan.remaining;
  
  console.log(`  本期消耗: ${actualConsumed} 课时 (预期: ${expectedConsumed})`);
  console.log(`  剩余课时: ${actualRemaining} 课时 (预期: ${expectedRemaining})`);
  
  if (actualConsumed === expectedConsumed && actualRemaining === expectedRemaining) {
    console.log(chalk.green('  ✓ 场景1验证通过: 重复签到已被去重'));
  } else {
    console.log(chalk.red('  ✗ 场景1验证失败'));
  }
}

function runScenario2_Transfer() {
  printSection('场景2：转班处理');
  console.log(chalk.cyan('\n说明: 张三于2024-01-18从英语A班转到英语B班。'));
  console.log(chalk.cyan('      2024-01-08和01-15的课属于A班，2024-01-20和01-27的课属于B班。'));
  console.log(chalk.cyan('      预期: 转班日期前后的课程按正确班级归属。'));

  resetStorage();

  storage.saveStudents([
    {
      id: 'STU_S001',
      studentId: 'S001',
      name: '张三',
      totalLessons: 50,
      usedLessons: 10,
      className: '英语A班',
      classId: 'ENG-A'
    }
  ]);

  storage.saveSchedules([
    {classId: 'ENG-A', className: '英语A班', lessonDate: '2024-01-08', startTime: '09:00', lessonHours: 2},
    {classId: 'ENG-A', className: '英语A班', lessonDate: '2024-01-15', startTime: '09:00', lessonHours: 2},
    {classId: 'ENG-B', className: '英语B班', lessonDate: '2024-01-20', startTime: '10:00', lessonHours: 2},
    {classId: 'ENG-B', className: '英语B班', lessonDate: '2024-01-27', startTime: '10:00', lessonHours: 2}
  ].map(s => ({...s, id: `${s.classId}|${s.lessonDate}|${s.startTime}`})));

  storage.saveAttendances([
    {id: 's001|eng-a|2024-01-08|09:00', studentId: 'STU_S001', classId: 'ENG-A', lessonDate: '2024-01-08', startTime: '09:00', status: '正常'},
    {id: 's001|eng-a|2024-01-15|09:00', studentId: 'STU_S001', classId: 'ENG-A', lessonDate: '2024-01-15', startTime: '09:00', status: '正常'},
    {id: 's001|eng-b|2024-01-20|10:00', studentId: 'STU_S001', classId: 'ENG-B', lessonDate: '2024-01-20', startTime: '10:00', status: '正常'},
    {id: 's001|eng-b|2024-01-27|10:00', studentId: 'STU_S001', classId: 'ENG-B', lessonDate: '2024-01-27', startTime: '10:00', status: '正常'}
  ]);

  storage.saveTransfers([
    {
      id: 's001|eng-a|eng-b|2024-01-18',
      studentId: 'STU_S001',
      fromClassId: 'ENG-A',
      toClassId: 'ENG-B',
      transferDate: '2024-01-18',
      reason: '进度调整'
    }
  ]);

  const data = storage.loadAll();
  const result = calculator.calculateConsumption(data);
  
  const zhangsan = result.students.find(s => s.studentId === 'S001');
  printer.printStudentDetail(zhangsan);

  console.log(chalk.bold('\n验证结果:'));
  const classADates = zhangsan.details.filter(d => d.classId === 'ENG-A').map(d => d.date);
  const classBDates = zhangsan.details.filter(d => d.classId === 'ENG-B').map(d => d.date);
  
  console.log(`  A班上课日期: ${classADates.join(', ')} (预期: 2024-01-08, 2024-01-15)`);
  console.log(`  B班上课日期: ${classBDates.join(', ')} (预期: 2024-01-20, 2024-01-27)`);
  
  const hasCorrectA = classADates.includes('2024-01-08') && classADates.includes('2024-01-15');
  const hasCorrectB = classBDates.includes('2024-01-20') && classBDates.includes('2024-01-27');
  const noWrongA = !classADates.includes('2024-01-20') && !classADates.includes('2024-01-27');
  const noWrongB = !classBDates.includes('2024-01-08') && !classBDates.includes('2024-01-15');
  
  if (hasCorrectA && hasCorrectB && noWrongA && noWrongB) {
    console.log(chalk.green('  ✓ 场景2验证通过: 转班日期前后课程归属正确'));
  } else {
    console.log(chalk.red('  ✗ 场景2验证失败'));
  }
}

function runScenario3_Makeup() {
  printSection('场景3：请假与补课关联');
  console.log(chalk.cyan('\n说明: 李四在2024-01-10请假，之后在2024-01-24补课。'));
  console.log(chalk.cyan('      张三在2024-01-22请假但未补课。'));
  console.log(chalk.cyan('      预期: 已补课的请假不扣课，未补课的请假显示待补课。'));

  resetStorage();

  storage.saveStudents([
    {id: 'STU_S001', studentId: 'S001', name: '张三', totalLessons: 50, usedLessons: 10, className: '英语A班', classId: 'ENG-A'},
    {id: 'STU_S002', studentId: 'S002', name: '李四', totalLessons: 40, usedLessons: 5, className: '数学B班', classId: 'MATH-B'}
  ]);

  storage.saveSchedules([
    {classId: 'ENG-A', className: '英语A班', lessonDate: '2024-01-22', startTime: '09:00', lessonHours: 2},
    {classId: 'MATH-B', className: '数学B班', lessonDate: '2024-01-10', startTime: '14:00', lessonHours: 1.5},
    {classId: 'MATH-B', className: '数学B班', lessonDate: '2024-01-24', startTime: '14:00', lessonHours: 1.5}
  ].map(s => ({...s, id: `${s.classId}|${s.lessonDate}|${s.startTime}`})));

  storage.saveLeaves([
    {
      id: 's001|eng-a|2024-01-22|09:00',
      studentId: 'STU_S001',
      classId: 'ENG-A',
      lessonDate: '2024-01-22',
      startTime: '09:00',
      reason: '生病',
      madeUp: false
    },
    {
      id: 's002|math-b|2024-01-10|14:00',
      studentId: 'STU_S002',
      classId: 'MATH-B',
      lessonDate: '2024-01-10',
      startTime: '14:00',
      reason: '家庭事务',
      madeUp: false
    }
  ]);

  storage.saveMakeups([
    {
      id: 's002|math-b|2024-01-10',
      studentId: 'STU_S002',
      originalClassId: 'MATH-B',
      originalDate: '2024-01-10',
      makeupClassId: 'MATH-B',
      makeupDate: '2024-01-24',
      makeupStartTime: '14:00'
    }
  ]);

  storage.saveAttendances([
    {
      id: 's002|math-b|2024-01-24|14:00',
      studentId: 'STU_S002',
      classId: 'MATH-B',
      lessonDate: '2024-01-24',
      startTime: '14:00',
      status: '正常',
      isMakeup: true,
      originalLeaveDate: '2024-01-10'
    }
  ]);

  const data = storage.loadAll();
  const result = calculator.calculateConsumption(data);

  console.log(chalk.bold('\n--- 张三 (请假未补课) ---'));
  const zhangsan = result.students.find(s => s.studentId === 'S001');
  printer.printStudentDetail(zhangsan);

  console.log(chalk.bold('\n--- 李四 (请假已补课) ---'));
  const lisi = result.students.find(s => s.studentId === 'S002');
  printer.printStudentDetail(lisi);

  console.log(chalk.bold('\n验证结果:'));
  const zhangsanHasUnmade = zhangsan.unmadeLeaves.length > 0;
  const lisiNoUnmade = lisi.unmadeLeaves.length === 0;
  const lisiConsumed = lisi.periodConsumed;
  
  console.log(`  张三有待补课: ${zhangsanHasUnmade ? '是' : '否'} (预期: 是)`);
  console.log(`  李四无待补课: ${lisiNoUnmade ? '是' : '否'} (预期: 是)`);
  console.log(`  李四本期消耗: ${lisiConsumed} 课时 (预期: 0, 因为补课抵消)`);
  
  if (zhangsanHasUnmade && lisiNoUnmade && lisiConsumed === 0) {
    console.log(chalk.green('  ✓ 场景3验证通过: 请假-补课关联正确'));
  } else {
    console.log(chalk.red('  ✗ 场景3验证失败'));
  }
}

function runScenario4_BadData() {
  printSection('场景4：坏数据检测（异常场景）');
  console.log(chalk.cyan('\n说明: 以下异常情况应被检测到并报告:'));
  console.log(chalk.cyan('      1. 王五: 剩余课时不足3节 (30-28=2)'));
  console.log(chalk.cyan('      2. 赵六: 初始已用>总课时 (26>25)，课时透支'));
  console.log(chalk.cyan('      3. 王五: 有一个孤立的补课记录（没有对应请假）'));

  resetStorage();

  storage.saveStudents([
    {id: 'STU_S003', studentId: 'S003', name: '王五', totalLessons: 30, usedLessons: 28, className: '英语A班', classId: 'ENG-A'},
    {id: 'STU_S004', studentId: 'S004', name: '赵六', totalLessons: 25, usedLessons: 26, className: '语文C班', classId: 'CHN-C'}
  ]);

  storage.saveAttendances([
    {
      id: 's003|eng-a|2024-01-15|09:00',
      studentId: 'STU_S003',
      classId: 'ENG-A',
      lessonDate: '2024-01-15',
      startTime: '09:00',
      status: '正常',
      isMakeup: true
    }
  ]);

  const data = storage.loadAll();
  const result = calculator.calculateConsumption(data);

  printer.printStudentList(result.students);
  printer.printAnomalies(result.anomalies);
  printer.printManagerSummary(result.summary);

  console.log(chalk.bold('\n验证结果:'));
  const hasLowBalance = result.anomalies.some(a => a.type === 'low_balance' && a.studentId === 'S003');
  const hasOverdrawn = result.anomalies.some(a => a.type === 'overdrawn' && a.studentId === 'S004');
  const hasOrphan = result.anomalies.some(a => a.type === 'orphan_makeup' && a.studentId === 'S003');
  
  console.log(`  检测到余额不足: ${hasLowBalance ? '是' : '否'} (预期: 是)`);
  console.log(`  检测到课时透支: ${hasOverdrawn ? '是' : '否'} (预期: 是)`);
  console.log(`  检测到孤立补课: ${hasOrphan ? '是' : '否'} (预期: 是)`);
  
  if (hasLowBalance && hasOverdrawn && hasOrphan) {
    console.log(chalk.green('  ✓ 场景4验证通过: 异常数据已正确检测'));
  } else {
    console.log(chalk.red('  ✗ 场景4验证失败'));
  }
  
  console.log(chalk.bold('\n风险预警:'));
  result.summary.risks.forEach(r => console.log(chalk.red('  ⚠  ' + r)));
  
  console.log(chalk.bold('\n待办事项:'));
  result.summary.todos.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
}

console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.cyan('║           培训机构课消核对CLI - 完整演示                        ║'));
console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════╝'));

console.log('\n' + chalk.white.bgMagenta(' 本演示包含以下4个场景: '));
console.log('  1. 正常扣课 + 重复签到去重');
console.log('  2. 转班日期前后课程归属');
console.log('  3. 请假与补课关联校验');
console.log('  4. 坏数据检测与异常报告');

runScenario1_NormalDeduction();
runScenario2_Transfer();
runScenario3_Makeup();
runScenario4_BadData();

printSection('演示完成');
console.log(chalk.green('\n✓ 所有场景演示完成!'));
console.log(chalk.cyan('\n可用命令:'));
console.log('  node src/cli.js import students samples/students.json');
console.log('  node src/cli.js import schedules samples/schedules.json');
console.log('  node src/cli.js import attendances samples/attendances.json');
console.log('  node src/cli.js import leaves samples/leaves.json');
console.log('  node src/cli.js import makeups samples/makeups.json');
console.log('  node src/cli.js import transfers samples/transfers.json');
console.log('  node src/cli.js check');
console.log('  node src/cli.js check --details');
console.log('  node src/cli.js detail S001');
console.log('  node src/cli.js correct S001 -1 -r "手动扣课"');
console.log('  node src/cli.js export 账单.xlsx');
console.log();
