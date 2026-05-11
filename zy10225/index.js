#!/usr/bin/env node

const { Command } = require('commander');
const moment = require('moment');
const inquirer = require('inquirer');
const path = require('path');
const chalk = require('chalk');

const { 
  initDatabase, 
  initConfig, 
  loadConfig, 
  closeDb 
} = require('./db');
const { DATA_TYPES } = require('./config');
const { importData } = require('./importer');
const { runAllValidations, getValidationSummary } = require('./validator');
const {
  createSettlement,
  calculateSettlementPreview,
  adjustSettlementItem,
  confirmSettlement,
  getSettlementById,
  getSettlementHistory,
  deleteDraftSettlement
} = require('./settlement');
const { 
  exportToCsv, 
  exportToJson, 
  exportVendorStatement,
  exportImportHistory
} = require('./exporter');
const {
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printHeader,
  printValidationResult,
  printSettlementPreview,
  printSettlementDetail,
  printSettlementHistory,
  printImportResult
} = require('./cli');

const program = new Command();

program
  .name('market-settle')
  .description('手作市集摊主结算 CLI - 管理摊主、摊位、销售额、押金、电费、退款、抽成比例和已付款记录')
  .version('1.0.0');

program
  .command('init')
  .description('初始化结算系统')
  .option('--market-name <name>', '市集名称', '手作市集')
  .option('--default-commission <rate>', '默认抽成比例 (0-1)', parseFloat, 0.1)
  .action(async (options) => {
    try {
      printHeader('初始化系统');
      
      await initDatabase();
      const config = initConfig(undefined, {
        marketName: options.marketName,
        defaultCommissionRate: options.defaultCommission
      });
      
      printSuccess(`已初始化 ${config.marketName} 结算系统`);
      printInfo(`默认抽成比例: ${(config.defaultCommissionRate * 100).toFixed(1)}%`);
      printInfo('数据存储在 .market-settlement 目录下');
    } catch (err) {
      printError(`初始化失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('import <type> <file>')
  .description('导入数据 (vendor, booth, sales, deposit, electricity, refund, commission_rate, payment, vendor_booth_assignment)')
  .option('-f, --force', '强制重新导入已导入过的文件')
  .action(async (type, file, options) => {
    try {
      const validTypes = [
        DATA_TYPES.VENDOR,
        DATA_TYPES.BOOTH,
        DATA_TYPES.SALES,
        DATA_TYPES.DEPOSIT,
        DATA_TYPES.ELECTRICITY,
        DATA_TYPES.REFUND,
        DATA_TYPES.COMMISSION_RATE,
        DATA_TYPES.PAYMENT,
        'vendor_booth_assignment'
      ];
      
      if (!validTypes.includes(type)) {
        printError(`无效的数据类型: ${type}`);
        printInfo(`有效的类型: ${validTypes.join(', ')}`);
        process.exit(1);
      }
      
      const absolutePath = path.resolve(file);
      await initDatabase();
      
      printHeader(`导入 ${type}`);
      const result = await importData(type, absolutePath, { force: options.force });
      printImportResult(result, type);
    } catch (err) {
      printError(`导入失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('validate')
  .description('校验所有数据的完整性和一致性')
  .action(async () => {
    try {
      printHeader('数据校验');
      await initDatabase();
      const result = await runAllValidations();
      printValidationResult(result);
      
      if (!result.isValid) {
        process.exit(1);
      }
    } catch (err) {
      printError(`校验失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('settle')
  .description('创建新的结算')
  .option('--period-start <date>', '结算周期开始日期 (YYYY-MM-DD)')
  .option('--period-end <date>', '结算周期结束日期 (YYYY-MM-DD)')
  .option('--settlement-date <date>', '结算日期 (默认今天)')
  .option('--auto', '自动计算周期 (最近7天)')
  .action(async (options) => {
    try {
      await initDatabase();
      
      let periodStart, periodEnd, settlementDate;
      
      if (options.auto) {
        periodEnd = moment().format('YYYY-MM-DD');
        periodStart = moment().subtract(6, 'days').format('YYYY-MM-DD');
      } else if (options.periodStart && options.periodEnd) {
        periodStart = options.periodStart;
        periodEnd = options.periodEnd;
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'periodStart',
            message: '结算周期开始日期 (YYYY-MM-DD):',
            default: moment().subtract(6, 'days').format('YYYY-MM-DD'),
            validate: (input) => moment(input, 'YYYY-MM-DD', true).isValid() || '请输入有效的日期格式'
          },
          {
            type: 'input',
            name: 'periodEnd',
            message: '结算周期结束日期 (YYYY-MM-DD):',
            default: moment().format('YYYY-MM-DD'),
            validate: (input) => moment(input, 'YYYY-MM-DD', true).isValid() || '请输入有效的日期格式'
          }
        ]);
        periodStart = answers.periodStart;
        periodEnd = answers.periodEnd;
      }
      
      settlementDate = options.settlementDate || moment().format('YYYY-MM-DD');
      
      printHeader(`创建结算 (${periodStart} ~ ${periodEnd})`);
      
      const validationResult = await runAllValidations();
      if (!validationResult.isValid) {
        printWarning('数据存在问题，是否继续？');
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: '数据校验发现错误，是否继续创建结算？',
            default: false
          }
        ]);
        if (!proceed) {
          printInfo('已取消创建结算');
          return;
        }
      }
      
      const result = await createSettlement(periodStart, periodEnd, settlementDate);
      printInfo(result.message);
      
      const preview = await calculateSettlementPreview(result.settlement.id);
      printSettlementPreview(preview);
      
      printInfo(`结算 ID: ${result.settlement.id}`);
      printInfo('下一步: 使用 "market-settle preview <settlementId>" 查看详情，或 "market-settle confirm <settlementId>" 确认结算');
      
    } catch (err) {
      printError(`创建结算失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('preview <settlementId>')
  .description('预览结算详情')
  .action(async (settlementId) => {
    try {
      await initDatabase();
      const detail = await getSettlementById(settlementId);
      
      if (!detail) {
        printError(`结算不存在: ${settlementId}`);
        process.exit(1);
      }
      
      printSettlementDetail(detail);
    } catch (err) {
      printError(`预览失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('adjust <settlementItemId>')
  .description('调整某摊主的结算金额')
  .option('--type <type>', '调整类型 (manual, refund, discount, penalty, other)')
  .option('--amount <amount>', '调整金额 (正数增加，负数减少)', parseFloat)
  .option('--reason <reason>', '调整原因')
  .option('--note <note>', '调整说明')
  .action(async (itemId, options) => {
    try {
      await initDatabase();
      
      let type, amount, reason, note;
      
      if (options.type && options.amount !== undefined) {
        type = options.type;
        amount = options.amount;
        reason = options.reason || '手动调整';
        note = options.note || '';
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: '调整类型:',
            choices: ['manual', 'refund', 'discount', 'penalty', 'other']
          },
          {
            type: 'input',
            name: 'amount',
            message: '调整金额 (正数增加应付，负数减少应付):',
            validate: (input) => !isNaN(parseFloat(input)) || '请输入有效的数字'
          },
          {
            type: 'input',
            name: 'reason',
            message: '调整原因:',
            default: '手动调整'
          },
          {
            type: 'input',
            name: 'note',
            message: '详细说明 (可选):',
            default: ''
          }
        ]);
        type = answers.type;
        amount = parseFloat(answers.amount);
        reason = answers.reason;
        note = answers.note;
      }
      
      const result = await adjustSettlementItem(itemId, type, amount, reason, note);
      printSuccess(result.message);
      printInfo(`原应付: ${result.previous_amount}`);
      printInfo(`新应付: ${result.new_amount}`);
      
    } catch (err) {
      printError(`调整失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('confirm <settlementId>')
  .description('确认结算 (确认后不可修改)')
  .option('-y, --yes', '跳过确认提示')
  .action(async (settlementId, options) => {
    try {
      await initDatabase();
      
      const detail = await getSettlementById(settlementId);
      if (!detail) {
        printError(`结算不存在: ${settlementId}`);
        process.exit(1);
      }
      
      printSettlementDetail(detail);
      
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.red.bold('确认结算后将不可修改，是否继续？'),
            default: false
          }
        ]);
        
        if (!confirm) {
          printInfo('已取消确认');
          return;
        }
      }
      
      const result = await confirmSettlement(settlementId);
      
      if (result.alreadyConfirmed) {
        printWarning(result.message);
      } else {
        printSuccess(result.message);
        printInfo(`共确认 ${result.itemCount} 个摊主的结算`);
      }
      
    } catch (err) {
      printError(`确认失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('history')
  .description('查看结算历史')
  .option('--status <status>', '按状态筛选 (draft, previewed, confirmed)')
  .option('--limit <n>', '显示最近 N 条', parseInt)
  .action(async (options) => {
    try {
      await initDatabase();
      
      const settlements = await getSettlementHistory({
        status: options.status,
        limit: options.limit
      });
      
      printSettlementHistory(settlements);
    } catch (err) {
      printError(`查询历史失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('export <settlementId>')
  .description('导出结算结果')
  .option('--format <format>', '导出格式 (csv, json)', 'csv')
  .option('--output <path>', '输出文件路径')
  .action(async (settlementId, options) => {
    try {
      await initDatabase();
      
      let outputPath;
      
      if (options.output) {
        outputPath = path.resolve(options.output);
      } else {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const ext = options.format === 'json' ? 'json' : 'csv';
        outputPath = path.resolve(process.cwd(), `settlement_${settlementId.substring(0, 8)}_${timestamp}.${ext}`);
      }
      
      let result;
      if (options.format === 'json') {
        result = await exportToJson(settlementId, outputPath);
      } else {
        result = await exportToCsv(settlementId, outputPath);
      }
      
      printSuccess(`已导出到: ${result.filePath}`);
      if (result.itemCount) {
        printInfo(`共 ${result.itemCount} 条记录`);
      }
      
    } catch (err) {
      printError(`导出失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('export-statement <settlementId> <vendorId>')
  .description('导出单个摊主的结算单')
  .option('--output <path>', '输出文件路径')
  .action(async (settlementId, vendorId, options) => {
    try {
      await initDatabase();
      
      let outputPath;
      
      if (options.output) {
        outputPath = path.resolve(options.output);
      } else {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        outputPath = path.resolve(process.cwd(), `statement_${vendorId}_${timestamp}.txt`);
      }
      
      const result = await exportVendorStatement(settlementId, vendorId, outputPath);
      
      printSuccess(`已导出摊主结算单: ${result.filePath}`);
      
    } catch (err) {
      printError(`导出失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('export-import-history')
  .description('导出导入历史记录')
  .option('--output <path>', '输出文件路径')
  .action(async (options) => {
    try {
      await initDatabase();
      
      let outputPath;
      
      if (options.output) {
        outputPath = path.resolve(options.output);
      } else {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        outputPath = path.resolve(process.cwd(), `import_history_${timestamp}.csv`);
      }
      
      const result = await exportImportHistory(outputPath);
      
      printSuccess(`已导出导入历史: ${result.filePath}`);
      printInfo(`共 ${result.recordCount} 条记录`);
      
    } catch (err) {
      printError(`导出失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program
  .command('delete-draft <settlementId>')
  .description('删除草稿状态的结算')
  .option('-y, --yes', '跳过确认提示')
  .action(async (settlementId, options) => {
    try {
      await initDatabase();
      
      const detail = await getSettlementById(settlementId);
      if (!detail) {
        printError(`结算不存在: ${settlementId}`);
        process.exit(1);
      }
      
      if (detail.settlement.status === 'confirmed') {
        printError('已确认的结算不能删除');
        process.exit(1);
      }
      
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `确定要删除结算 (${detail.settlement.period_start} ~ ${detail.settlement.period_end}) 吗？`,
            default: false
          }
        ]);
        
        if (!confirm) {
          printInfo('已取消删除');
          return;
        }
      }
      
      const result = await deleteDraftSettlement(settlementId);
      printSuccess(result.message);
      
    } catch (err) {
      printError(`删除失败: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  printError(`命令执行失败: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
