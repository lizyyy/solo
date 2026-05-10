const { table, getBorderCharacters } = require('table');
const chalk = require('chalk');
const { formatDate } = require('./utils');

function printHeader(title) {
  console.log('\n' + chalk.bold.blue('═'.repeat(60)));
  console.log(chalk.bold.blue('  ' + title));
  console.log(chalk.bold.blue('═'.repeat(60)));
}

function printImportResults(type, results) {
  printHeader(`导入结果 - ${type}`);
  console.log(chalk.green(`  ✓ 新增: ${results.added}`));
  if (results.updated > 0) console.log(chalk.yellow(`  ⚠  更新: ${results.updated}`));
  if (results.duplicates > 0) console.log(chalk.gray(`  → 跳过重复: ${results.duplicates}`));
  if (results.errors && results.errors.length > 0) {
    console.log(chalk.red(`  ✗ 错误: ${results.errors.length}`));
    results.errors.forEach(e => console.log('    ' + chalk.red(e)));
  }
  console.log();
}

function printManagerSummary(summary) {
  printHeader('【负责人视角】核对汇总');
  
  console.log('\n' + chalk.bold('一、关键指标'));
  const summaryTable = [
    [chalk.cyan('学生总数'), summary.totalStudents],
    [chalk.cyan('总购课时'), summary.totalLessonsPurchased],
    [chalk.cyan('已用课时'), summary.totalLessonsUsed],
    [chalk.cyan('剩余课时'), summary.totalLessonsRemaining],
    [chalk.cyan('课消率'), `${summary.utilizationRate}%`]
  ];
  console.log(table(summaryTable, {
    border: getBorderCharacters('ramac'),
    singleLine: true,
    columnDefault: { paddingLeft: 2, paddingRight: 2 }
  }));

  console.log('\n' + chalk.bold('二、风险预警'));
  if (summary.risks.length === 0) {
    console.log(chalk.green('  ✓ 暂无风险项'));
  } else {
    summary.risks.forEach(r => console.log(chalk.red('  ⚠  ' + r)));
  }

  console.log('\n' + chalk.bold('三、待办事项'));
  if (summary.todos.length === 0) {
    console.log(chalk.green('  ✓ 全部完成，无待办'));
  } else {
    summary.todos.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  }

  console.log('\n' + chalk.bold('四、已完成检查'));
  summary.completedChecks.forEach(c => console.log(chalk.green('  ' + c)));
}

function printStudentList(students, showDetails = false) {
  printHeader('学生课时清单');
  
  const data = [
    [
      chalk.bold('学号'),
      chalk.bold('姓名'),
      chalk.bold('班级'),
      chalk.bold('总课时'),
      chalk.bold('已用'),
      chalk.bold('本期消耗'),
      chalk.bold('调整'),
      chalk.bold('剩余'),
      chalk.bold('状态')
    ]
  ];

  for (const s of students) {
    let status = chalk.green('正常');
    if (s.isOverdrawn) status = chalk.red('透支');
    else if (s.hasLowBalance) status = chalk.yellow('不足');
    
    data.push([
      s.studentId,
      s.studentName,
      s.className || '-',
      s.totalLessons,
      s.initialUsed,
      s.periodConsumed,
      s.corrections,
      s.remaining,
      status
    ]);
  }

  console.log(table(data, {
    border: getBorderCharacters('ramac'),
    singleLine: true,
    columnDefault: { paddingLeft: 1, paddingRight: 1 }
  }));

  if (showDetails) {
    for (const s of students) {
      if (s.details.length > 0 || s.unmadeLeaves.length > 0) {
        printStudentDetail(s);
      }
    }
  }
}

function printStudentDetail(student) {
  printHeader(`个人明细 - ${student.studentName} (${student.studentId})`);
  
  console.log(chalk.cyan(`\n  班级: ${student.className || '-'}  |  总课时: ${student.totalLessons}  |  已用: ${student.usedLessons}  |  剩余: ${student.remaining}`));
  
  if (student.details.length > 0) {
    console.log('\n' + chalk.bold('  上课记录:'));
    const detailData = [
      [chalk.bold('日期'), chalk.bold('班级'), chalk.bold('时间'), chalk.bold('课时'), chalk.bold('类型'), chalk.bold('扣课'), chalk.bold('备注')]
    ];
    
    for (const d of student.details) {
      detailData.push([
        formatDate(d.date),
        d.className || d.classId,
        d.startTime || '-',
        d.hours,
        d.deductionType,
        d.deducted ? chalk.green('是') : chalk.yellow('否'),
        d.anomaly ? chalk.red(d.anomaly.message) : '-'
      ]);
    }
    console.log(table(detailData, {
      border: getBorderCharacters('norc'),
      singleLine: true,
      columnDefault: { paddingLeft: 1, paddingRight: 1 }
    }));
  }

  if (student.unmadeLeaves.length > 0) {
    console.log('\n' + chalk.yellow.bold('  待补课记录:'));
    for (const l of student.unmadeLeaves) {
      console.log(`    • ${formatDate(l.date)} [${l.classId}] ${l.reason || '无原因'}`);
    }
  }

  console.log();
}

function printAnomalies(anomalies) {
  if (anomalies.length === 0) {
    printHeader('异常检查');
    console.log(chalk.green('  ✓ 未发现异常数据\n'));
    return;
  }

  printHeader('异常记录');
  
  const data = [
    [chalk.bold('类型'), chalk.bold('学生'), chalk.bold('日期'), chalk.bold('说明')]
  ];

  const typeLabels = {
    overdrawn: chalk.red('课时透支'),
    low_balance: chalk.yellow('余额不足'),
    orphan_makeup: chalk.magenta('孤立补课')
  };

  for (const a of anomalies) {
    data.push([
      typeLabels[a.type] || a.type,
      `${a.studentName} (${a.studentId})`,
      formatDate(a.date) || '-',
      a.message
    ]);
  }

  console.log(table(data, {
    border: getBorderCharacters('ramac'),
    singleLine: true,
    columnDefault: { paddingLeft: 1, paddingRight: 1 }
  }));
}

function printCheckResult(calcResult) {
  printManagerSummary(calcResult.summary);
  printStudentList(calcResult.students);
  printAnomalies(calcResult.anomalies);
}

module.exports = {
  printHeader,
  printImportResults,
  printManagerSummary,
  printStudentList,
  printStudentDetail,
  printAnomalies,
  printCheckResult
};
