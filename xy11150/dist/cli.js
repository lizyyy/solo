#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const FileImporter_1 = require("./importer/FileImporter");
const DedupProcessor_1 = require("./processor/DedupProcessor");
const program = new commander_1.Command();
program
    .name('shuttle-dedup')
    .description('企业班车队班车报名去重工具')
    .version('1.0.0');
program
    .command('process')
    .description('处理班车报名数据，进行去重')
    .argument('<files...>', '要处理的CSV文件路径')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('-e, --encoding <encoding>', '文件编码: UTF-8, GBK, GB2312, Auto', 'Auto')
    .option('-d, --delimiter <delimiter>', 'CSV分隔符', ',')
    .option('--no-header', 'CSV文件没有表头')
    .action(async (files, options) => {
    console.log(chalk_1.default.bold.blue('\n' + '='.repeat(60)));
    console.log(chalk_1.default.bold.blue('       企业班车队班车报名去重工具'));
    console.log(chalk_1.default.bold.blue('='.repeat(60) + '\n'));
    const outputDir = path.resolve(options.output);
    const importOptions = {
        encoding: options.encoding,
        delimiter: options.delimiter,
        hasHeader: options.header
    };
    const resolvedFiles = files.map(f => path.resolve(f));
    const validFiles = [];
    const invalidFiles = [];
    for (const file of resolvedFiles) {
        if (!fs.existsSync(file)) {
            invalidFiles.push({ file, error: '文件不存在' });
        }
        else if (!fs.statSync(file).isFile()) {
            invalidFiles.push({ file, error: '不是有效的文件' });
        }
        else {
            validFiles.push(file);
        }
    }
    if (invalidFiles.length > 0) {
        console.log(chalk_1.default.yellow('⚠️  发现以下无效文件:'));
        for (const inv of invalidFiles) {
            console.log(chalk_1.default.yellow(`   ${path.basename(inv.file)}: ${inv.error}`));
        }
        console.log();
    }
    if (validFiles.length === 0) {
        console.log(chalk_1.default.red('❌ 没有可处理的有效文件！'));
        process.exit(1);
    }
    console.log(chalk_1.default.cyan(`📁 待处理文件: ${validFiles.length} 个`));
    for (const file of validFiles) {
        console.log(chalk_1.default.gray(`   - ${path.basename(file)}`));
    }
    console.log();
    const spinner = (0, ora_1.default)('正在导入数据...').start();
    let importResult;
    try {
        const importer = new FileImporter_1.FileImporter();
        importResult = importer.importFiles(validFiles, importOptions);
        spinner.succeed(`数据导入完成！`);
    }
    catch (error) {
        spinner.fail('数据导入失败！');
        if (error instanceof FileImporter_1.ColumnMappingError) {
            console.log(chalk_1.default.red(`\n❌ 列映射错误: ${error.message}`));
            console.log(chalk_1.default.yellow(`   可用列: ${error.availableColumns.join(', ')}`));
        }
        else if (error instanceof FileImporter_1.FileImportError) {
            console.log(chalk_1.default.red(`\n❌ 文件导入错误: ${error.message}`));
            console.log(chalk_1.default.yellow(`   文件名: ${error.fileName}`));
        }
        else {
            console.log(chalk_1.default.red(`\n❌ 发生未知错误: ${error instanceof Error ? error.message : String(error)}`));
        }
        console.log(chalk_1.default.gray('\n💡 提示: 请确保CSV文件包含以下必要列: 员工编号(或工号)、姓名、手机号、线路名称\n'));
        process.exit(1);
    }
    console.log(chalk_1.default.green(`   成功导入: ${importResult.records.length} 条有效记录`));
    if (importResult.invalidRecords.length > 0) {
        console.log(chalk_1.default.yellow(`   无效记录: ${importResult.invalidRecords.length} 条`));
    }
    console.log();
    for (const fr of importResult.fileResults) {
        if (fr.success) {
            console.log(chalk_1.default.green(`   ✅ ${fr.fileName}: ${fr.recordCount} 条记录`));
        }
        else {
            console.log(chalk_1.default.red(`   ❌ ${fr.fileName}: ${fr.error}`));
        }
    }
    console.log();
    if (importResult.records.length === 0) {
        console.log(chalk_1.default.red('❌ 没有有效记录可处理！'));
        process.exit(1);
    }
    spinner.start('正在进行去重处理...');
    let processResult;
    try {
        const processor = new DedupProcessor_1.DedupProcessor(outputDir);
        processResult = processor.process(importResult.records, outputDir);
        spinner.succeed('去重处理完成！');
    }
    catch (error) {
        spinner.fail('去重处理失败！');
        console.log(chalk_1.default.red(`\n❌ 处理错误: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
    console.log();
    console.log(chalk_1.default.bold('📊 处理结果统计:'));
    console.log(chalk_1.default.cyan(`   总记录数: ${processResult.totalRecords}`));
    console.log(chalk_1.default.green(`   有效记录数: ${processResult.validRecords}`));
    console.log(chalk_1.default.yellow(`   重复记录组数: ${processResult.duplicateRecords.length}`));
    console.log(chalk_1.default.blue(`   发现调岗记录: ${processResult.transferRecords.length} 条`));
    console.log(chalk_1.default.magenta(`   发现多人共用手机号: ${processResult.sharedPhoneRecords.length} 个`));
    console.log();
    console.log(chalk_1.default.bold('📁 输出文件:'));
    console.log(chalk_1.default.green(`   去重结果: ${path.relative(process.cwd(), processResult.outputPath)}`));
    console.log(chalk_1.default.green(`   复核报告: ${path.relative(process.cwd(), processResult.reportPath)}`));
    console.log();
    if (importResult.invalidRecords.length > 0) {
        console.log(chalk_1.default.yellow('⚠️  存在无效记录，详细信息:'));
        for (const inv of importResult.invalidRecords.slice(0, 10)) {
            console.log(chalk_1.default.yellow(`   ${inv.sourceFile} 第${inv.rowNumber}行: ${inv.errors.join(', ')}`));
        }
        if (importResult.invalidRecords.length > 10) {
            console.log(chalk_1.default.yellow(`   ... 还有 ${importResult.invalidRecords.length - 10} 条无效记录`));
        }
        console.log();
    }
    console.log(chalk_1.default.bold.green('✅ 处理完成！\n'));
    console.log(chalk_1.default.gray(`运行ID: ${processResult.runId}`));
    console.log(chalk_1.default.gray(`处理时间: ${processResult.processedAt.toLocaleString('zh-CN')}\n`));
});
program
    .command('list-history')
    .description('查看处理历史记录')
    .option('-o, --output <dir>', '输出目录', './output')
    .action((options) => {
    const outputDir = path.resolve(options.output);
    const historyPath = path.join(outputDir, '.history', 'run_history.json');
    if (!fs.existsSync(historyPath)) {
        console.log(chalk_1.default.yellow('暂无处理历史记录\n'));
        return;
    }
    try {
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        console.log(chalk_1.default.bold.blue('\n' + '='.repeat(60)));
        console.log(chalk_1.default.bold.blue('       处理历史记录'));
        console.log(chalk_1.default.bold.blue('='.repeat(60) + '\n'));
        for (let i = history.length - 1; i >= Math.max(0, history.length - 10); i--) {
            const run = history[i];
            console.log(chalk_1.default.cyan(`[${history.length - i}] 运行ID: ${run.runId}`));
            console.log(chalk_1.default.gray(`    处理时间: ${new Date(run.processedAt).toLocaleString('zh-CN')}`));
            console.log(chalk_1.default.gray(`    输入文件: ${run.inputFiles.join(', ')}`));
            console.log(chalk_1.default.gray(`    记录数量: ${run.recordHashes.length} 条`));
            console.log();
        }
        if (history.length > 10) {
            console.log(chalk_1.default.gray(`... 还有 ${history.length - 10} 条历史记录\n`));
        }
    }
    catch {
        console.log(chalk_1.default.red('❌ 读取历史记录失败\n'));
    }
});
program
    .command('validate')
    .description('验证CSV文件格式是否正确')
    .argument('<file>', '要验证的CSV文件路径')
    .option('-e, --encoding <encoding>', '文件编码: UTF-8, GBK, GB2312, Auto', 'Auto')
    .option('-d, --delimiter <delimiter>', 'CSV分隔符', ',')
    .action((file, options) => {
    console.log(chalk_1.default.bold.blue('\n' + '='.repeat(60)));
    console.log(chalk_1.default.bold.blue('       CSV文件格式验证'));
    console.log(chalk_1.default.bold.blue('='.repeat(60) + '\n'));
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.log(chalk_1.default.red('❌ 文件不存在\n'));
        process.exit(1);
    }
    try {
        const importer = new FileImporter_1.FileImporter();
        const result = importer.importFile(filePath, {
            encoding: options.encoding,
            delimiter: options.delimiter
        });
        console.log(chalk_1.default.green('✅ 文件格式验证通过！\n'));
        console.log(chalk_1.default.cyan('📊 文件信息:'));
        console.log(`   记录数量: ${result.records.length} 条`);
        console.log(`   无效记录: ${result.invalidRecords.length} 条`);
        console.log(`   列名: ${result.headers.join(', ')}`);
        console.log();
        if (result.invalidRecords.length > 0) {
            console.log(chalk_1.default.yellow('⚠️  无效记录详情:'));
            for (const inv of result.invalidRecords.slice(0, 5)) {
                console.log(chalk_1.default.yellow(`   第${inv.rowNumber}行: ${inv.errors.join(', ')}`));
            }
            if (result.invalidRecords.length > 5) {
                console.log(chalk_1.default.yellow(`   ... 还有 ${result.invalidRecords.length - 5} 条无效记录`));
            }
            console.log();
        }
    }
    catch (error) {
        if (error instanceof FileImporter_1.ColumnMappingError) {
            console.log(chalk_1.default.red('❌ 列名验证失败！\n'));
            console.log(chalk_1.default.red(`   错误: ${error.message}`));
            console.log(chalk_1.default.yellow(`   可用列: ${error.availableColumns.join(', ')}`));
            console.log();
            console.log(chalk_1.default.gray('💡 提示: 请确保CSV文件包含以下必要列名之一:\n'));
            console.log(chalk_1.default.gray('   员工编号: 员工编号、工号、employeeId、empId、编号'));
            console.log(chalk_1.default.gray('   员工姓名: 姓名、员工姓名、employeeName、name'));
            console.log(chalk_1.default.gray('   手机号: 手机号、手机号码、电话、phone、mobile、telephone'));
            console.log(chalk_1.default.gray('   线路名称: 线路、班车线路、线路名称、routeName、route\n'));
        }
        else if (error instanceof FileImporter_1.FileImportError) {
            console.log(chalk_1.default.red('❌ 文件导入失败！\n'));
            console.log(chalk_1.default.red(`   错误: ${error.message}`));
            console.log();
        }
        else {
            console.log(chalk_1.default.red(`❌ 发生未知错误: ${error instanceof Error ? error.message : String(error)}\n`));
        }
        process.exit(1);
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map