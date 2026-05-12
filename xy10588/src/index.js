#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { 
  BATCH_STATUS,
  isInitialized,
  initializeFiles
} = require('./utils/storage');

const {
  registerBatch,
  registerSample,
  registerTestItem,
  submitReport,
  submitReinspectionReport,
  registerUsage,
  manualCorrection,
  checkBatchStatus,
  getAllBatchesSummary,
  getHistory,
  getBatchesByStatus
} = require('./services/batchService');

const program = new Command();

function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

function printError(message) {
  console.log(chalk.red(`✗ ${message}`));
}

function printWarning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

function printInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`));
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

function statusColor(status) {
  switch (status) {
    case BATCH_STATUS.QUALIFIED:
      return chalk.green(status);
    case BATCH_STATUS.FROZEN:
      return chalk.red(status);
    case BATCH_STATUS.VIOLATION:
      return chalk.red.bold(status);
    case BATCH_STATUS.PENDING_REPORT:
      return chalk.yellow(status);
    default:
      return chalk.cyan(status);
  }
}

program
  .name('mat-inspect')
  .description('工程材料送检批次管理 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化材料送检批次管理系统')
  .option('-f, --force', '强制重新初始化（会清除现有数据）')
  .action((options) => {
    if (isInitialized() && !options.force) {
      printWarning('系统已初始化。使用 --force 参数强制重新初始化');
      return;
    }
    
    initializeFiles();
    printSuccess('材料送检批次管理系统初始化成功');
    printInfo('数据存储位置: .mat-inspect/');
  });

program
  .command('import')
  .description('导入数据')
  .option('-t, --type <type>', '数据类型: batch/sample/test/report/usage')
  .option('-f, --file <file>', 'JSON 文件路径')
  .option('-o, --operator <name>', '操作者名称', 'operator')
  .action((options) => {
    if (!isInitialized()) {
      printError('系统未初始化，请先运行 init 命令');
      return;
    }
    
    const fs = require('fs');
    const path = require('path');
    
    if (!options.file || !fs.existsSync(options.file)) {
      printError('请提供有效的 JSON 文件路径');
      return;
    }
    
    const content = fs.readFileSync(options.file, 'utf-8');
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      printError('JSON 文件解析失败: ' + e.message);
      return;
    }
    
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    let successCount = 0;
    let failCount = 0;
    
    data.forEach(item => {
      let result;
      switch (options.type) {
        case 'batch':
          result = registerBatch(item, options.operator);
          break;
        case 'sample':
          result = registerSample(item, options.operator);
          break;
        case 'test':
          result = registerTestItem(item, options.operator);
          break;
        case 'report':
          if (item.isReinspection) {
            result = submitReinspectionReport(item, options.operator);
          } else {
            result = submitReport(item, options.operator);
          }
          break;
        case 'usage':
          result = registerUsage(item, options.operator);
          break;
        default:
          printError('未知的数据类型: ' + options.type);
          return;
      }
      
      if (result.success) {
        successCount++;
        printSuccess(`导入成功: ${item.batchNo || item.reportNo || item.id}`);
      } else {
        failCount++;
        printError(`导入失败: ${item.batchNo || item.reportNo || item.id} - ${result.error}`);
      }
    });
    
    printInfo(`导入完成: 成功 ${successCount} 条，失败 ${failCount} 条`);
  });

program
  .command('check')
  .description('检查批次状态')
  .option('-b, --batch <batchNo>', '检查指定批次号')
  .option('-a, --all', '检查所有批次')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    if (!isInitialized()) {
      printError('系统未初始化，请先运行 init 命令');
      return;
    }
    
    if (options.all) {
      const result = getAllBatchesSummary();
      if (!result.success) {
        printError(result.error);
        return;
      }
      
      const { summary, batches } = result.data;
      
      const summaryTable = new Table({
        head: ['指标', '数量'],
        colWidths: [20, 10]
      });
      
      summaryTable.push(
        ['总批次', summary.total],
        [chalk.green('可使用'), summary.qualified],
        [chalk.yellow('待报告'), summary.pendingReport],
        [chalk.red('已冻结'), summary.frozen],
        [chalk.red.bold('违规使用'), summary.violation]
      );
      
      console.log('\n' + summaryTable.toString());
      
      if (batches.length > 0) {
        const detailTable = new Table({
          head: ['批次号', '材料', '规格', '数量', '状态', '进场日期'],
          colWidths: [15, 15, 12, 10, 12, 12]
        });
        
        batches.forEach(batch => {
          detailTable.push([
            batch.batchNo,
            batch.materialName,
            batch.specification,
            `${batch.quantity}${batch.unit}`,
            statusColor(batch.status),
            batch.arrivalDate
          ]);
        });
        
        console.log('\n批次明细:\n' + detailTable.toString());
      }
      
      if (summary.violation > 0 || summary.frozen > 0) {
        printWarning('存在问题批次，请重点关注！');
      } else {
        printSuccess('所有批次状态正常');
      }
      
    } else if (options.status) {
      const batches = getBatchesByStatus(options.status);
      
      if (batches.length === 0) {
        printInfo(`没有找到状态为 "${options.status}" 的批次`);
        return;
      }
      
      const table = new Table({
        head: ['批次号', '材料', '规格', '数量', '进场日期'],
        colWidths: [15, 15, 12, 10, 12]
      });
      
      batches.forEach(batch => {
        table.push([
          batch.batchNo,
          batch.materialName,
          batch.specification,
          `${batch.quantity}${batch.unit}`,
          batch.arrivalDate
        ]);
      });
      
      console.log(`\n状态: ${statusColor(options.status)}\n${table.toString()}`);
      
    } else if (options.batch) {
      const result = checkBatchStatus(options.batch);
      if (!result.success) {
        printError(result.error);
        return;
      }
      
      const { batch, samples, testItems, reports, usages, history, issues, latestReport, summary } = result.data;
      
      const batchTable = new Table({
        head: ['属性', '值'],
        colWidths: [15, 50]
      });
      
      batchTable.push(
        ['批次号', batch.batchNo],
        ['材料类型', batch.materialType],
        ['材料名称', batch.materialName],
        ['规格型号', batch.specification],
        ['数量', `${batch.quantity}${batch.unit}`],
        ['供应商', batch.supplier],
        ['生产批次', batch.productionBatch || '-'],
        ['进场日期', batch.arrivalDate],
        ['存放位置', batch.location],
        ['状态', statusColor(batch.status)],
        ['进场检验员', batch.inspector || '-'],
        ['备注', batch.remark || '-']
      );
      
      console.log('\n批次信息:\n' + batchTable.toString());
      
      console.log('\n汇总信息:');
      const summaryTable = new Table({
        head: ['项目', '数量'],
        colWidths: [15, 10]
      });
      
      summaryTable.push(
        ['取样记录', summary.sampleCount],
        ['检测项目', summary.testItemCount],
        ['报告', summary.reportCount],
        ['使用记录', summary.usageCount],
        ['问题数', summary.issueCount]
      );
      
      console.log(summaryTable.toString());
      
      if (samples.length > 0) {
        console.log('\n取样记录:');
        const sampleTable = new Table({
          head: ['取样编号', '取样人', '见证', '取样日期', '取样位置', '送检'],
          colWidths: [18, 10, 10, 12, 15, 8]
        });
        
        samples.forEach(s => {
          sampleTable.push([
            s.sampleNo,
            s.sampler,
            s.witness || '-',
            s.samplingDate,
            s.samplingLocation,
            s.deliveryToLab ? chalk.green('是') : chalk.red('否')
          ]);
        });
        
        console.log(sampleTable.toString());
      }
      
      if (testItems.length > 0) {
        console.log('\n检测项目:');
        const testTable = new Table({
          head: ['检测项目', '检测标准', '要求值', '结果', '合格'],
          colWidths: [15, 20, 15, 15, 8]
        });
        
        testItems.forEach(t => {
          testTable.push([
            t.testItem,
            t.testStandard,
            t.requiredValue || '-',
            t.result || '-',
            t.isQualified === null ? '-' : (t.isQualified ? chalk.green('是') : chalk.red('否'))
          ]);
        });
        
        console.log(testTable.toString());
      }
      
      if (reports.length > 0) {
        console.log('\n检测报告:');
        const reportTable = new Table({
          head: ['报告编号', '实验室', '日期', '结论', '回传时间'],
          colWidths: [20, 15, 12, 10, 20]
        });
        
        reports.forEach(r => {
          reportTable.push([
            r.reportNo,
            r.lab,
            r.reportDate,
            r.isQualified ? chalk.green('合格') : chalk.red('不合格'),
            formatDate(r.receivedAt)
          ]);
        });
        
        console.log(reportTable.toString());
      }
      
      if (usages.length > 0) {
        console.log('\n使用记录:');
        const usageTable = new Table({
          head: ['使用日期', '数量', '位置', '使用人', '违规'],
          colWidths: [12, 10, 15, 10, 8]
        });
        
        usages.forEach(u => {
          usageTable.push([
            u.usageDate,
            `${u.usedQuantity}`,
            u.usedLocation,
            u.user,
            u.isViolation ? chalk.red.bold('是') : chalk.green('否')
          ]);
        });
        
        console.log(usageTable.toString());
      }
      
      if (issues.length > 0) {
        console.log('\n问题清单:');
        issues.forEach(issue => {
          const color = issue.severity === 'HIGH' ? chalk.red : 
                        issue.severity === 'MEDIUM' ? chalk.yellow : chalk.blue;
          console.log(color(`  [${issue.severity}] ${issue.message}`));
        });
      } else {
        printSuccess('该批次无问题');
      }
      
      if (history.length > 0) {
        console.log('\n历史变更记录:');
        const historyTable = new Table({
          head: ['时间', '操作', '类型', '实体', '操作者', '原因'],
          colWidths: [20, 10, 10, 20, 10, 20]
        });
        
        history.forEach(h => {
          historyTable.push([
            formatDate(h.timestamp),
            h.action,
            h.entityType,
            h.entityId,
            h.operator,
            h.reason || '-'
          ]);
        });
        
        console.log(historyTable.toString());
      }
    } else {
      printInfo('请指定 --batch <批次号> 或 --all 或 --status <状态>');
    }
  });

program
  .command('detail')
  .description('查看批次详情')
  .argument('<batchNo>', '批次号')
  .option('-h, --history', '只看历史')
  .action((batchNo, options) => {
    if (!isInitialized()) {
      printError('系统未初始化，请先运行 init 命令');
      return;
    }
    
    if (options.history) {
      const history = getHistory('BATCH', batchNo);
      
      if (history.length === 0) {
        printInfo('无历史记录');
        return;
      }
      
      const table = new Table({
        head: ['时间', '操作', '实体类型', '实体ID', '操作者', '原因'],
        colWidths: [22, 12, 12, 18, 10, 20]
      });
      
      history.forEach(h => {
        table.push([
          formatDate(h.timestamp),
          h.action,
          h.entityType,
          h.entityId,
          h.operator,
          h.reason || '-'
        ]);
      });
      
      console.log(table.toString());
      
      console.log('\n变更详情:');
      history.forEach((h, idx) => {
        console.log(`\n${chalk.cyan(`#${idx + 1} ${h.action} ${h.entityType} - ${h.entityId}`)}`);
        try {
          const changes = JSON.parse(h.changes);
          if (changes.before) {
            console.log('  修改前:');
            console.log(JSON.stringify(changes.before, null, 4));
          }
          console.log('  修改后:');
          console.log(JSON.stringify(changes.after, null, 4));
        } catch (e) {
          console.log('  无法解析变更内容');
        }
      });
    } else {
      program.parse(['node', 'mat-inspect', 'check', '--batch', batchNo]);
    }
  });

program
  .command('report')
  .description('报告相关操作')
  .option('-l, --list', '列出所有报告')
  .option('-b, --batch <batchNo>', '按批次查询')
  .option('-n, --reportNo <reportNo>', '查询单个报告详情')
  .action((options) => {
    if (!isInitialized()) {
      printError('系统未初始化，请先运行 init 命令');
      return;
    }
    
    const { getReports, getReportsByBatch, getReportById } = require('./services/batchService');
    
    let reports = [];
    
    if (options.reportNo) {
      const report = getReportById(options.reportNo);
      if (!report) {
        printError('报告不存在');
        return;
      }
      reports = [report];
    } else if (options.batch) {
      reports = getReportsByBatch(options.batch);
    } else {
      reports = getReports();
    }
    
    if (reports.length === 0) {
      printInfo('没有报告记录');
      return;
    }
    
    const table = new Table({
      head: ['报告编号', '批次号', '实验室', '日期', '结论', '复检', '回传时间'],
      colWidths: [22, 18, 15, 12, 10, 8, 20]
    });
    
    reports.forEach(r => {
      table.push([
        r.reportNo,
        r.batchNo,
        r.lab,
        r.reportDate,
        r.isQualified ? chalk.green('合格') : chalk.red('不合格'),
        r.isReinspection ? chalk.yellow('是') : '-',
        formatDate(r.receivedAt)
      ]);
    });
    
    console.log(table.toString());
  });

program
  .command('correct')
  .description('人工修正数据')
  .requiredOption('-t, --type <type>', '实体类型: batch/sample/test/report')
  .requiredOption('-i, --id <id>', '实体 ID 或批次号/报告号')
  .requiredOption('-k, --key <key>', '要修改的字段')
  .requiredOption('-v, --value <value>', '新值')
  .requiredOption('-o, --operator <name>', '操作者')
  .requiredOption('-r, --reason <reason>', '修正原因')
  .action((options) => {
    if (!isInitialized()) {
      printError('系统未初始化，请先运行 init 命令');
      return;
    }
    
    const updates = {};
    updates[options.key] = options.value;
    
    const result = manualCorrection(
      options.type,
      options.id,
      updates,
      options.operator,
      options.reason
    );
    
    if (result.success) {
      printSuccess('修正成功');
      console.log('修改前:');
      console.log(JSON.stringify(result.changes.before, null, 2));
      console.log('\n修改后:');
      console.log(JSON.stringify(result.changes.after, null, 2));
    } else {
      printError(result.error);
    }
  });

program
  .command('demo')
  .description('运行演示脚本')
  .option('-p, --path <path>', '演示脚本路径')
  .action((options) => {
    const { spawn } = require('child_process');
    const path = require('path');
    
    const scriptPath = options.path || path.join(__dirname, '..', 'scripts', 'demo.sh');
    
    const demo = spawn('bash', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    demo.on('close', (code) => {
      if (code === 0) {
        printSuccess('演示完成');
      } else {
        printError('演示失败');
      }
    });
  });

program.parse(process.argv);
