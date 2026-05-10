#!/usr/bin/env node

const { Command } = require('commander');
const { ensureDirs, logError } = require('./src/utils');
const importCmd = require('./src/commands/import');
const checkCmd = require('./src/commands/check');
const txCmd = require('./src/commands/transactions');
const confirmCmd = require('./src/commands/confirm');
const reportCmd = require('./src/commands/report');

const program = new Command();

ensureDirs();

program
  .name('cpi')
  .description('书法班临摹纸库存管理CLI')
  .version('1.0.0');

const importSub = program.command('import')
  .description('导入数据');

importSub.command('specs <file>')
  .description('导入纸张规格 (CSV: id,name,unit)')
  .action((file) => {
    importCmd.importSpecs(file);
  });

importSub.command('courses <file>')
  .description('导入学生课程 (CSV: id,studentId,studentName,courseName,lessonNumber,date,status)')
  .action((file) => {
    importCmd.importCourses(file);
  });

importSub.command('issues <file>')
  .description('导入发放记录 (CSV: specId,studentId,studentName,courseId,quantity,reasonCode,reasonText)')
  .action((file) => {
    importCmd.importIssues(file);
  });

importSub.command('inventory <file>')
  .description('导入盘点记录 (CSV: specId,quantity,reasonCode,reasonText)')
  .action((file) => {
    importCmd.importInventory(file);
  });

importSub.command('reissues <file>')
  .description('导入补发记录 (CSV: specId,studentId,studentName,courseId,quantity,reasonCode,reasonText,approvedBy,approvedAt)')
  .action((file) => {
    importCmd.importReissues(file);
  });

importSub.command('refunds <file>')
  .description('导入退费记录 (CSV: specId,studentId,studentName,courseId,quantity,reasonCode,reasonText)')
  .action((file) => {
    importCmd.importRefunds(file);
  });

const checkSub = program.command('check')
  .description('异常检查');

checkSub.command('anomalies')
  .description('运行异常检测')
  .action(() => {
    checkCmd.runCheck();
  });

checkSub.command('list')
  .description('列出异常记录')
  .option('--status <status>', '按状态筛选: open/resolved')
  .option('--severity <severity>', '按严重程度筛选: high/medium/low')
  .action((options) => {
    checkCmd.listAnomalies(options);
  });

checkSub.command('resolve <anomalyId>')
  .description('标记异常为已解决')
  .option('--by <operator>', '操作人')
  .action((anomalyId, options) => {
    checkCmd.resolveAnomaly(anomalyId, options.by);
  });

checkSub.command('fix-spec <anomalyId> <correctSpecId>')
  .description('修正规格不匹配异常')
  .action((anomalyId, correctSpecId) => {
    checkCmd.fixSpecMismatch(anomalyId, correctSpecId);
  });

checkSub.command('remove-duplicate <anomalyId>')
  .description('删除重复交易')
  .action((anomalyId) => {
    checkCmd.removeDuplicate(anomalyId);
  });

const txSub = program.command('tx')
  .description('交易管理: 盘点、发放、退费、补发');

txSub.command('inventory <specId> <physicalQty>')
  .description('创建盘点记录: inventory <规格ID> <实际数量>')
  .option('--by <operator>', '操作人')
  .action((specId, physicalQty, options) => {
    txCmd.createInventoryCheck(specId, parseInt(physicalQty), options.by);
  });

txSub.command('issue <specId> <studentId> <quantity>')
  .description('发放纸张: issue <规格ID> <学生ID> <数量>')
  .option('--name <studentName>', '学生姓名')
  .option('--course <courseId>', '关联课程ID')
  .option('--reason <text>', '发放原因')
  .action((specId, studentId, quantity, options) => {
    txCmd.createIssue(specId, studentId, options.name, parseInt(quantity), options.course, {
      reasonText: options.reason
    });
  });

txSub.command('refund <specId> <studentId> <quantity>')
  .description('退费回库: refund <规格ID> <学生ID> <数量>')
  .option('--name <studentName>', '学生姓名')
  .option('--course <courseId>', '关联课程ID')
  .option('--reason <text>', '退费原因')
  .action((specId, studentId, quantity, options) => {
    txCmd.createRefund(specId, studentId, options.name, parseInt(quantity), options.course, {
      reasonText: options.reason
    });
  });

txSub.command('reissue <specId> <studentId> <quantity>')
  .description('补发纸张: reissue <规格ID> <学生ID> <数量>')
  .option('--name <studentName>', '学生姓名')
  .option('--course <courseId>', '关联课程ID')
  .option('--reason <text>', '补发原因 (必填)')
  .option('--approved-by <approver>', '审批人 (必填)')
  .action((specId, studentId, quantity, options) => {
    if (!options.reason) {
      logError('补发必须提供原因: --reason');
      process.exit(1);
    }
    if (!options.approvedBy) {
      logError('补发必须提供审批人: --approved-by');
      process.exit(1);
    }
    txCmd.createReissue(specId, studentId, options.name, parseInt(quantity), {
      courseId: options.course,
      reasonText: options.reason,
      approvedBy: options.approvedBy
    });
  });

txSub.command('update <transactionId>')
  .description('更新未确认交易的字段')
  .option('--spec <specId>', '新的规格ID')
  .option('--student <studentId>', '新的学生ID')
  .option('--name <studentName>', '新的学生姓名')
  .option('--course <courseId>', '新的课程ID')
  .option('--qty <quantity>', '新的数量 (注意: 发放/补发为负数)')
  .option('--reason-code <code>', '原因代码')
  .option('--reason-text <text>', '原因说明')
  .option('--approved-by <approver>', '审批人')
  .action((transactionId, options) => {
    const updates = {};
    if (options.spec) updates.specId = options.spec;
    if (options.student) updates.studentId = options.student;
    if (options.name) updates.studentName = options.name;
    if (options.course) updates.courseId = options.course;
    if (options.qty) updates.quantity = parseInt(options.qty);
    if (options.reasonCode) updates.reasonCode = options.reasonCode;
    if (options.reasonText) updates.reasonText = options.reasonText;
    if (options.approvedBy) {
      updates.approvedBy = options.approvedBy;
      updates.approvedAt = Date.now();
    }
    txCmd.updateTransaction(transactionId, updates);
  });

txSub.command('delete <transactionId>')
  .description('删除未确认的交易')
  .action((transactionId) => {
    txCmd.deleteTransaction(transactionId);
  });

txSub.command('list')
  .description('列出交易记录')
  .option('--type <type>', '交易类型: issue/refund/reissue/inventory_check')
  .option('--status <status>', '状态: pending/confirmed')
  .option('--spec <specId>', '规格ID')
  .option('--student <studentId>', '学生ID或姓名')
  .action((options) => {
    const list = txCmd.listTransactions({
      type: options.type,
      status: options.status,
      specId: options.spec,
      studentId: options.student
    });
    list.forEach(t => {
      console.log(`[${t.id}] ${t.type} | ${t.specId} | ${t.studentName || '-'} | qty:${t.quantity} | ${t.status}`);
    });
    console.log(`共 ${list.length} 条记录`);
  });

const confirmSub = program.command('confirm')
  .description('确认交易');

confirmSub.command('all')
  .description('确认所有待处理交易（必须先解决所有异常）')
  .option('--by <operator>', '操作人')
  .action((options) => {
    confirmCmd.confirmAll(options.by);
  });

confirmSub.command('tx <transactionId>')
  .description('确认单条交易')
  .option('--by <operator>', '操作人')
  .action((transactionId, options) => {
    confirmCmd.confirmTransaction(transactionId, options.by);
  });

confirmSub.command('reset')
  .description('重置待处理区，从已确认区恢复基础数据')
  .action(() => {
    confirmCmd.resetPending();
  });

const reportSub = program.command('report')
  .description('报表输出');

reportSub.command('inventory')
  .description('当前库存汇总')
  .action(() => {
    reportCmd.inventorySummary();
  });

reportSub.command('tx')
  .description('交易汇总')
  .action(() => {
    reportCmd.transactionSummary();
  });

reportSub.command('diff')
  .description('生成库存差异报告')
  .option('--json <outputPath>', '输出为JSON文件')
  .option('--csv <outputPath>', '输出为CSV文件 (给老师看)')
  .action((options) => {
    if (options.json) {
      reportCmd.generateDiffReport('pending', options.json);
    } else if (options.csv) {
      reportCmd.exportDiffCsv('pending', options.csv);
    } else {
      reportCmd.generateDiffReport('pending');
    }
  });

reportSub.command('student <studentId>')
  .description('学生用纸汇总')
  .action((studentId) => {
    reportCmd.studentReport(studentId);
  });

program.parse(process.argv);
