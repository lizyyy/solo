#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const file_reader_1 = require("./file-reader");
const reconciliation_engine_1 = require("./reconciliation-engine");
const file_writer_1 = require("./file-writer");
const program = new commander_1.Command();
program
    .name('spr-reconcile')
    .description('备件返厂记录维修件状态对账 CLI 工具')
    .version('1.0.0')
    .requiredOption('--return-file <path>', '返厂单 CSV 文件路径')
    .requiredOption('--inventory-file <path>', '库存表 CSV 文件路径')
    .requiredOption('--inspection-file <path>', '检测结果 CSV 文件路径')
    .requiredOption('-o, --output <path>', '对账结果输出 CSV 文件路径')
    .option('-v, --verbose', '显示详细处理日志')
    .action(async (options) => {
    try {
        console.log(chalk_1.default.bold.blue('========================================'));
        console.log(chalk_1.default.bold.blue('    备件返厂记录维修件状态对账工具'));
        console.log(chalk_1.default.bold.blue('========================================'));
        console.log('');
        console.log(chalk_1.default.cyan('📂 正在读取数据文件...'));
        const returnOrders = await file_reader_1.FileReader.readReturnOrders(options.returnFile);
        const inventoryItems = await file_reader_1.FileReader.readInventory(options.inventoryFile);
        const inspectionResults = await file_reader_1.FileReader.readInspectionResults(options.inspectionFile);
        console.log(chalk_1.default.green(`✅ 返厂单: ${returnOrders.length} 条记录`));
        console.log(chalk_1.default.green(`✅ 库存表: ${inventoryItems.length} 条记录`));
        console.log(chalk_1.default.green(`✅ 检测结果: ${inspectionResults.length} 条记录`));
        console.log('');
        console.log(chalk_1.default.cyan('🔍 正在执行对账逻辑...'));
        const engine = new reconciliation_engine_1.ReconciliationEngine(returnOrders, inventoryItems, inspectionResults);
        const result = engine.reconcile();
        console.log('');
        if (options.verbose) {
            console.log(chalk_1.default.magenta('📝 详细处理日志:'));
            for (const log of result.detailedLogs) {
                console.log(log);
            }
            console.log('');
        }
        console.log(chalk_1.default.cyan('💾 正在导出对账结果...'));
        await file_writer_1.FileWriter.writeReconciliationResult(result, options.output);
        console.log(chalk_1.default.green(`✅ 对账结果已导出到: ${options.output}`));
        console.log(chalk_1.default.green(`✅ 对账摘要已导出到: ${options.output.replace('.csv', '_摘要.txt')}`));
        console.log('');
        console.log(chalk_1.default.bold.green('✅ 备件返厂记录维修件状态对账完成!'));
        console.log('');
        console.log(chalk_1.default.yellow('📊 对账摘要:'));
        console.log(`   总记录数: ${result.summary.totalRecords}`);
        console.log(`   正常记录: ${result.summary.normalCount} ${chalk_1.default.green('✓')}`);
        console.log(`   异常记录: ${result.summary.abnormalCount} ${chalk_1.default.red('✗')}`);
        console.log('');
        console.log(chalk_1.default.yellow('📋 异常分类:'));
        console.log(`   拆件维修: ${result.summary.breakdown.dismantleRepair} 条`);
        console.log(`   检测驳回: ${result.summary.breakdown.inspectionRejected} 条`);
        console.log(`   承运商丢件: ${result.summary.breakdown.carrierLost} 条`);
        console.log(`   状态不一致: ${result.summary.breakdown.statusMismatch} 条`);
        console.log(`   库存缺失: ${result.summary.breakdown.inventoryMissing} 条`);
        console.log(`   检测缺失: ${result.summary.breakdown.inspectionMissing} 条`);
        console.log('');
    }
    catch (error) {
        console.error(chalk_1.default.bold.red('\n❌ 对账过程中发生错误:'));
        console.error(chalk_1.default.red(error.message));
        console.error('');
        process.exit(1);
    }
});
program.parse();
