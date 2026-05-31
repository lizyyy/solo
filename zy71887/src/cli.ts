#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { Database } from './database';
import { DataImporter } from './importer';
import { DataExporter } from './exporter';
import { FilterCriteria, ExportConfig, GradingRecord } from './types';

const program = new Command();
const db = new Database();
const importer = new DataImporter(db);
const exporter = new DataExporter(db);

program
  .name('collision-tool')
  .description('碰撞动量守恒实验数据处理工具 - 实验室助教专用')
  .version('1.0.0');

program
  .command('import')
  .description('导入实验数据')
  .argument('<file>', '数据文件路径 (CSV或Excel)')
  .option('-o, --operator <name>', '操作人姓名', '助教')
  .option('-r, --reason <text>', '导入原因/备注')
  .action(async (file, options) => {
    console.log(chalk.blue(`\n=== 开始导入数据 ===`));
    console.log(chalk.gray(`文件: ${file}`));
    console.log(chalk.gray(`操作人: ${options.operator}`));

    try {
      let result;
      if (file.endsWith('.csv')) {
        result = await importer.importFromCSV(file, options.operator, options.reason);
      } else if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
        result = importer.importFromExcel(file, options.operator, options.reason);
      } else {
        console.log(chalk.red('错误: 不支持的文件格式，请使用CSV或Excel文件'));
        process.exit(1);
      }

      console.log(chalk.green(`\n导入完成!`));
      console.log(chalk.white(`批次ID: ${result.batchId}`));
      console.log(chalk.white(`新增记录: ${result.importedCount}`));
      console.log(chalk.white(`更新记录: ${result.updatedCount}`));
      console.log(chalk.white(`跳过记录: ${result.skippedCount}`));

      if (result.unitErrors.length > 0) {
        console.log(chalk.yellow(`\n⚠ 单位换算提示 (${result.unitErrors.length}条):`));
        result.unitErrors.slice(0, 5).forEach((err, i) => {
          console.log(chalk.yellow(`  ${i + 1}. 记录 ${err.recordId}: 字段"${err.field}" - ${err.suggestion}`));
        });
        if (result.unitErrors.length > 5) {
          console.log(chalk.yellow(`  ...还有 ${result.unitErrors.length - 5} 条提示`));
        }
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`\n✗ 错误 (${result.errorCount}条):`));
        result.errors.slice(0, 10).forEach((err, i) => {
          console.log(chalk.red(`  ${i + 1}. ${err}`));
        });
        if (result.errors.length > 10) {
          console.log(chalk.red(`  ...还有 ${result.errors.length - 10} 条错误`));
        }
      }

      console.log(chalk.gray(`\n数据目录: ${db.getDataDir()}`));
    } catch (e: any) {
      console.log(chalk.red(`导入失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出实验记录')
  .option('-s, --status <status>', '按状态筛选 (pending/imported/reviewed/graded/withdrawn)')
  .option('--has-anomalies', '只显示有异常的记录')
  .option('--student-id <id>', '按学号筛选')
  .option('--batch-id <id>', '按批次筛选')
  .option('-n, --limit <n>', '显示数量限制', '20')
  .action((options) => {
    console.log(chalk.blue(`\n=== 实验记录列表 ===`));

    const filter: FilterCriteria = {};
    if (options.status) filter.status = [options.status];
    if (options.hasAnomalies) filter.hasAnomalies = true;
    if (options.studentId) filter.studentId = options.studentId;
    if (options.batchId) filter.importBatchId = options.batchId;

    const records = db.filterRecords(filter).slice(0, parseInt(options.limit));

    if (records.length === 0) {
      console.log(chalk.yellow('没有找到匹配的记录'));
      return;
    }

    console.log(chalk.white(`共找到 ${db.filterRecords(filter).length} 条记录，显示前 ${records.length} 条:\n`));

    records.forEach((record, index) => {
      const statusColor = record.status === 'graded' ? chalk.green :
                         record.status === 'pending' ? chalk.yellow :
                         record.status === 'withdrawn' ? chalk.red : chalk.blue;
      
      const anomalyBadge = record.anomalies.length > 0 
        ? chalk.red(` [异常${record.anomalies.length}]`) 
        : '';

      const scoreBadge = record.grading 
        ? chalk.cyan(` 得分:${record.grading.score}`) 
        : '';

      console.log(
        `${index + 1}. ${chalk.white(record.student.studentId)} ${chalk.bold(record.student.studentName)} ` +
        `${statusColor(`[${record.status}]`)}${anomalyBadge}${scoreBadge}`
      );
      console.log(`   ${chalk.gray(`记录ID: ${record.id} | 批次: ${record.importBatchId}`)}`);
      
      if (record.anomalies.length > 0) {
        record.anomalies.slice(0, 2).forEach(a => {
          console.log(`   ${chalk.yellow('!')} ${a.message}`);
        });
      }
      console.log();
    });
  });

program
  .command('show')
  .description('查看单条记录详情')
  .argument('<recordId>', '记录ID')
  .option('--history', '显示操作历史')
  .action((recordId, options) => {
    const record = db.getRecord(recordId);
    if (!record) {
      console.log(chalk.red(`错误: 记录 ${recordId} 不存在`));
      process.exit(1);
    }

    console.log(chalk.blue(`\n=== 记录详情 ===`));
    console.log(chalk.white(`记录ID: ${record.id}`));
    console.log(chalk.white(`状态: ${record.status} | 版本: ${record.version}`));
    console.log();

    console.log(chalk.bold('学生信息:'));
    console.log(`  学号: ${record.student.studentId}`);
    console.log(`  姓名: ${record.student.studentName}`);
    console.log(`  组别: ${record.student.groupId || '-'}`);
    console.log(`  日期: ${record.student.experimentDate}`);
    console.log();

    console.log(chalk.bold('原始数据:'));
    console.log(`  钢球质量: ${record.rawData.ballMass} kg`);
    console.log(`  钢球直径: ${record.rawData.ballDiameter} m`);
    console.log(`  初始高度: ${record.rawData.initialHeight} cm`);
    console.log(`  水平位移: ${record.rawData.horizontalDisplacement} cm`);
    console.log(`  碰撞位移: ${record.rawData.collisionDisplacement} cm`);
    console.log();

    console.log(chalk.bold('计算结果:'));
    console.log(`  初始动量: ${record.calculation.initialMomentum.toFixed(4)} kg·m/s`);
    console.log(`  碰撞动量: ${record.calculation.collisionMomentum.toFixed(4)} kg·m/s`);
    console.log(`  动量损失率: ${chalk[record.calculation.momentumLossRate > 10 ? 'red' : 'green'](record.calculation.momentumLossRate.toFixed(2) + '%')}`);
    console.log(`  能量损失率: ${record.calculation.energyLossRate.toFixed(2)}%`);
    console.log();

    if (record.anomalies.length > 0) {
      console.log(chalk.bold.red('异常检测:'));
      record.anomalies.forEach((a, i) => {
        const sevColor = a.severity === 'error' ? chalk.red : a.severity === 'warning' ? chalk.yellow : chalk.blue;
        console.log(`  ${sevColor(i + 1 + '. [' + a.severity + '] ' + a.message)}`);
        console.log(`     ${chalk.gray('解释: ' + a.explanation)}`);
        console.log(`     ${chalk.cyan('建议: ' + a.suggestion)}`);
      });
      console.log();
    }

    if (record.grading) {
      console.log(chalk.bold('批改信息:'));
      console.log(`  得分: ${chalk.green(record.grading.score)}`);
      console.log(`  批改人: ${record.grading.gradedBy}`);
      console.log(`  时间: ${record.grading.gradedAt}`);
      console.log(`  意见: ${record.grading.comments}`);
      if (record.grading.previousScore !== undefined) {
        console.log(chalk.gray(`  (之前得分: ${record.grading.previousScore})`));
      }
      console.log();
    }

    if (options.history) {
      const history = db.getRecordHistory(recordId);
      console.log(chalk.bold('操作历史:'));
      if (history.length === 0) {
        console.log('  无历史记录');
      } else {
        history.forEach((h, i) => {
          console.log(`  ${i + 1}. ${h.timestamp}`);
          console.log(`     操作: ${h.action} | 操作人: ${h.operator}`);
          h.changes.forEach(c => {
            console.log(`     变更: ${c.field} = ${c.oldValue || '空'} → ${c.newValue || '空'}`);
          });
          if (h.reason) console.log(`     原因: ${h.reason}`);
        });
      }
      console.log();
    }

    console.log(chalk.gray(`创建时间: ${record.createdAt}`));
    console.log(chalk.gray(`更新时间: ${record.updatedAt}`));
  });

program
  .command('grade')
  .description('批改实验记录')
  .argument('<recordId>', '记录ID')
  .argument('<score>', '得分 (数字)')
  .argument('[comments...]', '批改意见')
  .option('-o, --operator <name>', '批改人姓名', '助教')
  .action((recordId, score, comments, options) => {
    const record = db.getRecord(recordId);
    if (!record) {
      console.log(chalk.red(`错误: 记录 ${recordId} 不存在`));
      process.exit(1);
    }

    const grading: GradingRecord = {
      gradedBy: options.operator,
      gradedAt: new Date().toISOString(),
      score: parseFloat(score),
      comments: comments.join(' ') || '已批改'
    };

    db.gradeRecord(recordId, grading, options.operator);

    console.log(chalk.green(`\n✓ 批改完成!`));
    console.log(`记录: ${recordId}`);
    console.log(`得分: ${score}`);
    console.log(`意见: ${grading.comments}`);
  });

program
  .command('export')
  .description('导出实验批改表')
  .option('-f, --format <type>', '导出格式 (csv/xlsx)', 'xlsx')
  .option('-o, --output <dir>', '输出目录')
  .option('--name <filename>', '文件名')
  .option('--status <status>', '按状态筛选')
  .option('--with-history', '包含操作历史')
  .option('--no-calculations', '不包含计算数据')
  .option('--no-anomalies', '不包含异常信息')
  .option('--no-grading', '不包含批改信息')
  .action(async (options) => {
    console.log(chalk.blue(`\n=== 导出实验批改表 ===`));

    const filter: FilterCriteria = {};
    if (options.status) filter.status = [options.status];

    const config: ExportConfig = {
      format: options.format,
      filename: options.name,
      includeCalculations: options.calculations !== false,
      includeAnomalies: options.anomalies !== false,
      includeGrading: options.grading !== false,
      includeHistory: options.withHistory || false
    };

    try {
      const result = await exporter.exportGradingSheet(filter, config, options.output);

      console.log(chalk.green(`\n✓ 导出完成!`));
      console.log(chalk.white(`文件: ${result.filePath}`));
      console.log(chalk.white(`记录数: ${result.recordCount}`));
      console.log();
      console.log(chalk.bold('统计摘要:'));
      console.log(`  总记录数: ${result.summary.totalRecords}`);
      console.log(`  已批改: ${result.summary.gradedRecords}`);
      console.log(`  待处理: ${result.summary.pendingRecords}`);
      console.log(`  有异常: ${result.summary.recordsWithAnomalies}`);
      console.log(`  平均分: ${result.summary.averageScore.toFixed(2)}`);
    } catch (e: any) {
      console.log(chalk.red(`导出失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('撤回/回滚一个导入批次')
  .argument('<batchId>', '批次ID')
  .argument('<reason>', '撤回原因')
  .option('-o, --operator <name>', '操作人姓名', '助教')
  .action((batchId, reason, options) => {
    const batch = db.getBatch(batchId);
    if (!batch) {
      console.log(chalk.red(`错误: 批次 ${batchId} 不存在`));
      process.exit(1);
    }

    console.log(chalk.yellow(`\n⚠ 即将撤回批次 ${batchId}`));
    console.log(`文件: ${batch.fileName}`);
    console.log(`记录数: ${batch.recordCount}`);
    console.log(`原因: ${reason}`);

    try {
      db.rollbackBatch(batchId, options.operator, reason);
      console.log(chalk.green(`\n✓ 批次已撤回!`));
      console.log(chalk.gray(`撤回记录已保存在历史记录中`));
    } catch (e: any) {
      console.log(chalk.red(`撤回失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('batches')
  .description('查看导入批次列表')
  .action(() => {
    console.log(chalk.blue(`\n=== 导入批次列表 ===`));

    const batches = db.getBatches();
    if (batches.length === 0) {
      console.log(chalk.yellow('暂无批次记录'));
      return;
    }

    batches.forEach((batch, i) => {
      const statusColor = batch.status === 'completed' ? chalk.green :
                         batch.status === 'rolled_back' ? chalk.red : chalk.yellow;
      console.log(`${i + 1}. ${chalk.bold(batch.id)} ${statusColor(`[${batch.status}]`)}`);
      console.log(`   文件: ${batch.fileName} | 记录数: ${batch.recordCount}`);
      console.log(`   时间: ${batch.importTime} | 操作人: ${batch.operator}`);
      if (batch.status === 'rolled_back') {
        console.log(chalk.red(`   撤回原因: ${batch.rollbackReason}`));
      }
      console.log();
    });
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-n, --limit <n>', '显示条数', '50')
  .action((options) => {
    console.log(chalk.blue(`\n=== 操作历史 ===`));

    const history = db.getAllHistory().slice(0, parseInt(options.limit));
    if (history.length === 0) {
      console.log(chalk.yellow('暂无历史记录'));
      return;
    }

    history.forEach((h, i) => {
      const actionColor = h.action === 'withdraw' ? chalk.red :
                         h.action === 'grade' ? chalk.green :
                         h.action === 'import' ? chalk.blue : chalk.yellow;
      console.log(`${i + 1}. ${chalk.gray(h.timestamp)} ${actionColor(h.action.padEnd(8))} ${h.operator.padEnd(6)} ${h.recordId}`);
      h.changes.forEach(c => {
        console.log(`     ${c.field}: ${c.oldValue || '空'} → ${c.newValue || '空'}`);
      });
      if (h.reason) {
        console.log(chalk.gray(`     原因: ${h.reason}`));
      }
    });
  });

program
  .command('check-units')
  .description('检查单位换算错误')
  .action(() => {
    console.log(chalk.blue(`\n=== 单位换算检查 ===`));

    const records = db.getAllRecords();
    const unitErrors = records.filter(r => r.anomalies.some(a => a.type === 'unit_error'));

    if (unitErrors.length === 0) {
      console.log(chalk.green('✓ 未检测到单位换算错误'));
      return;
    }

    console.log(chalk.yellow(`发现 ${unitErrors.length} 条记录存在单位问题:\n`));

    unitErrors.forEach((record, i) => {
      const unitAnomalies = record.anomalies.filter(a => a.type === 'unit_error');
      console.log(`${i + 1}. ${chalk.bold(record.student.studentName)} (${record.student.studentId})`);
      unitAnomalies.forEach(a => {
        console.log(chalk.yellow(`   ${a.message}`));
        console.log(chalk.cyan(`   建议: ${a.suggestion}`));
      });
      console.log();
    });
  });

program
  .command('sample')
  .description('生成样例数据文件')
  .action(() => {
    const xlsx = require('xlsx');
    const sampleData = [
      {
        studentId: '2024001',
        studentName: '张三',
        groupId: 'A1',
        experimentDate: '2024-05-20',
        ballMass: 0.067,
        ballDiameter: 0.025,
        initialHeight: 12.5,
        horizontalDisplacement: 35.2,
        collisionDisplacement: 28.6,
        notes: '第一次实验'
      },
      {
        studentId: '2024002',
        studentName: '李四',
        groupId: 'A1',
        experimentDate: '2024-05-20',
        ballMass: 0.067,
        ballDiameter: 0.025,
        initialHeight: 13.0,
        horizontalDisplacement: 36.1,
        collisionDisplacement: 29.3,
        notes: ''
      },
      {
        studentId: '2024003',
        studentName: '王五',
        groupId: 'A2',
        experimentDate: '2024-05-20',
        ballMass: 67,
        ballDiameter: 2.5,
        initialHeight: 12.0,
        horizontalDisplacement: 15.8,
        collisionDisplacement: 5.2,
        notes: '注意: 质量和直径单位可能有误'
      }
    ];

    const outputPath = require('path').join(process.cwd(), '实验数据样例.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleData);
    xlsx.utils.book_append_sheet(wb, ws, '实验数据');
    xlsx.writeFile(wb, outputPath);

    console.log(chalk.green(`✓ 样例文件已生成: ${outputPath}`));
    console.log(chalk.gray(`\n字段说明:`));
    console.log(`  studentId    - 学号`);
    console.log(`  studentName  - 姓名`);
    console.log(`  groupId      - 组别 (可选)`);
    console.log(`  experimentDate - 实验日期 (YYYY-MM-DD)`);
    console.log(`  ballMass     - 钢球质量 (kg)`);
    console.log(`  ballDiameter - 钢球直径 (m)`);
    console.log(`  initialHeight - 初始高度 (cm)`);
    console.log(`  horizontalDisplacement - 水平位移 (cm)`);
    console.log(`  collisionDisplacement  - 碰撞位移 (cm)`);
    console.log(`  notes        - 备注 (可选)`);
  });

program.parse(process.argv);
