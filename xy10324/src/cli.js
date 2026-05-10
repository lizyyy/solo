#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const importer = require('./importer');
const storage = require('./storage');
const calculator = require('./calculator');
const printer = require('./printer');
const exporter = require('./exporter');
const { generateId, parseAmount, normalizeDate } = require('./utils');

const program = new Command();

program
  .name('lesson-check')
  .description('培训机构课消核对工具')
  .version('1.0.0');

program
  .command('import <type> <file>')
  .description('导入数据 (类型: students, schedules, attendances, leaves, makeups, transfers)')
  .action((type, file) => {
    const typeMap = {
      students: { fn: importer.importStudents, save: storage.saveStudents, label: '学生课包' },
      schedules: { fn: importer.importSchedules, save: storage.saveSchedules, label: '班级排课' },
      attendances: { fn: importer.importAttendances, save: storage.saveAttendances, label: '签到记录' },
      leaves: { fn: importer.importLeaves, save: storage.saveLeaves, label: '请假记录' },
      makeups: { fn: importer.importMakeups, save: storage.saveMakeups, label: '补课记录' },
      transfers: { fn: importer.importTransfers, save: storage.saveTransfers, label: '转班记录' }
    };

    if (!typeMap[type]) {
      console.error(chalk.red(`未知类型: ${type}`));
      console.log('支持的类型: students, schedules, attendances, leaves, makeups, transfers');
      process.exit(1);
    }

    const filePath = path.resolve(file);
    const rows = importer.parseFile(filePath);
    const allData = storage.loadAll();
    
    const existingKey = type === 'students' ? 'students' :
                        type === 'schedules' ? 'schedules' :
                        type === 'attendances' ? 'attendances' :
                        type === 'leaves' ? 'leaves' :
                        type === 'makeups' ? 'makeups' : 'transfers';

    const result = typeMap[type].fn(rows, allData[existingKey]);
    typeMap[type].save(result.data);
    printer.printImportResults(typeMap[type].label, result.results);
  });

program
  .command('check')
  .description('执行课消核对')
  .option('--details', '显示所有学生明细')
  .action((options) => {
    const data = storage.loadAll();
    const result = calculator.calculateConsumption(data);
    printer.printCheckResult(result);
    if (options.details) {
      for (const s of result.students) {
        if (s.details.length > 0 || s.unmadeLeaves.length > 0) {
          printer.printStudentDetail(s);
        }
      }
    }
  });

program
  .command('detail <studentId>')
  .description('查看学生个人明细')
  .action((studentId) => {
    const data = storage.loadAll();
    const result = calculator.calculateConsumption(data);
    const student = result.students.find(s => s.studentId === studentId || s.id === `STU_${studentId}`);
    
    if (!student) {
      console.error(chalk.red(`未找到学生: ${studentId}`));
      process.exit(1);
    }
    
    printer.printStudentDetail(student);
  });

program
  .command('correct <studentId> <adjustment>')
  .description('修正异常：调整课时 (adjustment: 正数加课时, 负数扣课时)')
  .option('-r, --reason <reason>', '修正原因')
  .action((studentId, adjustment, options) => {
    const data = storage.loadAll();
    const student = data.students.find(s => s.studentId === studentId || s.id === `STU_${studentId}`);
    
    if (!student) {
      console.error(chalk.red(`未找到学生: ${studentId}`));
      process.exit(1);
    }

    const adj = parseAmount(adjustment);
    const correction = {
      id: generateId(student.id, Date.now()),
      studentId: student.id,
      adjustment: adj,
      reason: options.reason || '人工修正',
      createdAt: new Date().toISOString()
    };

    data.corrections.push(correction);
    storage.saveCorrections(data.corrections);

    const result = calculator.calculateConsumption(data);
    const updatedStudent = result.students.find(s => s.studentId === studentId);
    
    printer.printHeader('修正结果');
    console.log(chalk.cyan(`  学生: ${student.name} (${student.studentId})`));
    console.log(chalk.green(`  调整: ${adj > 0 ? '+' : ''}${adj} 课时`));
    console.log(chalk.cyan(`  原因: ${correction.reason}`));
    console.log(chalk.cyan(`  当前剩余: ${updatedStudent.remaining} 课时`));
    console.log();
  });

program
  .command('export [output]')
  .description('导出账单到Excel')
  .action((output) => {
    const data = storage.loadAll();
    const result = calculator.calculateConsumption(data);
    const outputPath = output ? path.resolve(output) : null;
    const savedPath = exporter.exportBill(result, outputPath);
    
    printer.printHeader('导出结果');
    console.log(chalk.green(`  ✓ 账单已导出到: ${savedPath}`));
    console.log();
  });

program
  .command('demo')
  .description('运行所有演示场景')
  .action(() => {
    require('../test/test-scenarios.js');
  });

program.parse(process.argv);
