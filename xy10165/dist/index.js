#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const database_1 = require("./database");
const models_1 = require("./models");
const budgetService_1 = require("./budgetService");
const excelService_1 = require("./excelService");
const reportService_1 = require("./reportService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const program = new commander_1.Command();
program
    .name('budget')
    .description('预算单据超支核验 CLI - 管理部门预算、采购申请和合同付款')
    .version('1.0.0');
program
    .command('init')
    .description('初始化数据库')
    .option('-f, --force', '强制重新初始化，删除现有数据')
    .action((options) => {
    try {
        if (!options.force && (0, database_1.databaseExists)()) {
            console.log(chalk_1.default.yellow('数据库已存在。如需重新初始化，请使用 --force 选项。'));
            console.log(chalk_1.default.yellow('警告: 使用 --force 将删除所有现有数据！'));
            process.exit(1);
        }
        if (options.force && (0, database_1.databaseExists)()) {
            console.log(chalk_1.default.yellow('正在删除现有数据库...'));
        }
        (0, database_1.initializeDatabase)(undefined, options.force);
        console.log(chalk_1.default.green('✓ 数据库初始化成功！'));
        console.log(chalk_1.default.cyan('\n下一步操作：'));
        console.log(chalk_1.default.cyan('  1. 生成模板: budget template --type budget'));
        console.log(chalk_1.default.cyan('  2. 导入数据: budget import <文件> --type budget'));
    }
    catch (error) {
        console.error(chalk_1.default.red('初始化失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('template')
    .description('生成 Excel 导入模板')
    .requiredOption('-t, --type <type>', '模板类型: budget | purchase | payment')
    .option('-o, --output <path>', '输出文件路径')
    .action((options) => {
    try {
        const type = options.type;
        const validTypes = ['budget', 'purchase', 'payment'];
        if (!validTypes.includes(type)) {
            console.error(chalk_1.default.red(`无效的模板类型: ${type}`));
            console.error(chalk_1.default.yellow('有效值: budget, purchase, payment'));
            process.exit(1);
        }
        const typeNames = {
            'budget': '预算',
            'purchase': '采购申请',
            'payment': '合同付款'
        };
        const outputPath = options.output || `./${type}_template.xlsx`;
        const absolutePath = path_1.default.resolve(outputPath);
        (0, excelService_1.saveTemplate)(type, absolutePath);
        console.log(chalk_1.default.green(`✓ ${typeNames[type]}模板已生成: ${absolutePath}`));
        const descriptions = {
            'budget': '包含部门、期间、预算类型、预算金额、阈值、描述',
            'purchase': '包含申请单号、部门、物品名称、申请金额、申请日期等',
            'payment': '包含付款单号、合同号、部门、申请单号、付款金额等'
        };
        console.log(chalk_1.default.cyan(`\n模板说明: ${descriptions[type]}`));
    }
    catch (error) {
        console.error(chalk_1.default.red('模板生成失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('import')
    .description('从 Excel 导入数据')
    .argument('<file>', 'Excel 文件路径')
    .requiredOption('-t, --type <type>', '导入类型: budget | purchase | payment')
    .option('-s, --sheet <name>', '工作表名称')
    .option('-p, --period <period>', '默认期间')
    .action((file, options) => {
    try {
        const type = options.type;
        const validTypes = ['budget', 'purchase', 'payment'];
        if (!validTypes.includes(type)) {
            console.error(chalk_1.default.red(`无效的导入类型: ${type}`));
            console.error(chalk_1.default.yellow('有效值: budget, purchase, payment'));
            process.exit(1);
        }
        const absolutePath = path_1.default.resolve(file);
        if (!fs_1.default.existsSync(absolutePath)) {
            console.error(chalk_1.default.red(`文件不存在: ${absolutePath}`));
            process.exit(1);
        }
        const typeNames = {
            'budget': '预算',
            'purchase': '采购申请',
            'payment': '合同付款'
        };
        console.log(chalk_1.default.cyan(`正在导入${typeNames[type]}数据...`));
        const summary = (0, excelService_1.importFromExcel)(absolutePath, {
            type,
            sheetName: options.sheet,
            period: options.period
        });
        console.log(chalk_1.default.green('\n导入完成！'));
        console.log(chalk_1.default.cyan(`  总计: ${summary.totalRecords} 条`));
        console.log(chalk_1.default.green(`  成功: ${summary.successCount} 条`));
        if (summary.errorCount > 0) {
            console.log(chalk_1.default.red(`  失败: ${summary.errorCount} 条`));
            console.log(chalk_1.default.yellow('\n错误详情：'));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan('行号'), chalk_1.default.cyan('字段'), chalk_1.default.cyan('错误信息')],
                colWidths: [10, 15, 50],
                wordWrap: true
            });
            summary.errors.slice(0, 10).forEach(err => {
                table.push([
                    err.row,
                    err.field,
                    err.message
                ]);
            });
            console.log(table.toString());
            if (summary.errors.length > 10) {
                console.log(chalk_1.default.yellow(`\n... 还有 ${summary.errors.length - 10} 条错误未显示`));
            }
            console.log(chalk_1.default.yellow('\n提示: 请检查数据格式后重试，重复导入会自动跳过已存在的记录。'));
        }
        else {
            console.log(chalk_1.default.cyan('\n提示: 您可以运行 budget check 检查预算状态'));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('导入失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('check')
    .description('检查预算超支和异常')
    .option('-i, --id <budget_id>', '检查特定预算')
    .option('--all', '显示所有预算（包括正常的）')
    .action((options) => {
    try {
        if (options.id) {
            const result = (0, budgetService_1.checkBudgetStatus)(options.id);
            if (!result) {
                console.error(chalk_1.default.red(`找不到预算: ${options.id}`));
                process.exit(1);
            }
            console.log(chalk_1.default.cyan('\n预算详情：'));
            const table = new cli_table3_1.default({
                head: [chalk_1.default.cyan('字段'), chalk_1.default.cyan('值')],
                colWidths: [20, 50]
            });
            table.push(['部门', result.departmentName], ['期间', result.period], ['预算类型', result.budgetType], ['预算金额', `¥${result.budgetAmount.toLocaleString()}`], ['已用金额', `¥${result.usedAmount.toLocaleString()}`], ['预留金额', `¥${result.reservedAmount.toLocaleString()}`], ['剩余金额', `¥${result.remainingAmount.toLocaleString()}`], ['使用率', `${(result.usageRate * 100).toFixed(1)}%`], ['阈值', `${(result.threshold * 100)}%`]);
            console.log(table.toString());
            if (result.issues.length > 0) {
                console.log(chalk_1.default.red('\n⚠ 发现问题：'));
                result.issues.forEach(issue => {
                    console.log(chalk_1.default.red(`  - ${issue}`));
                });
            }
            else {
                console.log(chalk_1.default.green('\n✓ 预算状态正常'));
            }
        }
        else {
            const results = (0, budgetService_1.checkAllBudgets)();
            const displayResults = options.all
                ? results
                : results.filter(r => r.isOverBudget || r.isOverThreshold);
            if (displayResults.length === 0) {
                console.log(chalk_1.default.green('\n✓ 所有预算状态正常！'));
                if (!options.all) {
                    console.log(chalk_1.default.cyan('使用 --all 查看所有预算详情'));
                }
                return;
            }
            console.log(chalk_1.default.yellow(`\n发现 ${displayResults.length} 个需要关注的预算：`));
            const table = new cli_table3_1.default({
                head: [
                    chalk_1.default.cyan('部门'),
                    chalk_1.default.cyan('期间'),
                    chalk_1.default.cyan('类型'),
                    chalk_1.default.cyan('预算金额'),
                    chalk_1.default.cyan('已用金额'),
                    chalk_1.default.cyan('使用率'),
                    chalk_1.default.cyan('状态')
                ],
                colWidths: [15, 10, 10, 15, 15, 12, 12],
                wordWrap: true
            });
            displayResults.forEach(r => {
                let status = chalk_1.default.green('正常');
                if (r.isOverBudget) {
                    status = chalk_1.default.red('超支');
                }
                else if (r.isOverThreshold) {
                    status = chalk_1.default.yellow('超阈值');
                }
                table.push([
                    r.departmentName,
                    r.period,
                    r.budgetType,
                    `¥${r.budgetAmount.toLocaleString()}`,
                    `¥${r.usedAmount.toLocaleString()}`,
                    `${(r.usageRate * 100).toFixed(1)}%`,
                    status
                ]);
            });
            console.log(table.toString());
            const overBudgetCount = results.filter(r => r.isOverBudget).length;
            const overThresholdCount = results.filter(r => r.isOverThreshold && !r.isOverBudget).length;
            console.log(chalk_1.default.cyan(`\n汇总: 超支 ${overBudgetCount} 个, 超阈值 ${overThresholdCount} 个`));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('检查失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('history')
    .description('查看历史记录')
    .option('-t, --type <type>', '记录类型: budget | exception | import')
    .option('-i, --id <id>', '特定预算 ID（仅 budget 类型）')
    .option('-n, --limit <number>', '显示数量限制', '20')
    .action((options) => {
    try {
        const type = options.type || 'budget';
        const limit = parseInt(options.limit) || 20;
        if (type === 'budget') {
            const history = options.id
                ? (0, models_1.getBudgetHistory)(options.id)
                : (0, models_1.getBudgetHistory)();
            if (history.length === 0) {
                console.log(chalk_1.default.yellow('没有找到预算变更记录'));
                return;
            }
            console.log(chalk_1.default.cyan('\n预算变更历史：'));
            const table = new cli_table3_1.default({
                head: [
                    chalk_1.default.cyan('时间'),
                    chalk_1.default.cyan('部门'),
                    chalk_1.default.cyan('期间'),
                    chalk_1.default.cyan('类型'),
                    chalk_1.default.cyan('操作'),
                    chalk_1.default.cyan('金额')
                ],
                colWidths: [20, 12, 8, 8, 10, 15],
                wordWrap: true
            });
            history.slice(0, limit).forEach(h => {
                table.push([
                    h.created_at,
                    h.department_name || '',
                    h.period || '',
                    h.budget_type || '',
                    h.action_type,
                    `¥${h.amount.toLocaleString()}`
                ]);
            });
            console.log(table.toString());
        }
        else if (type === 'exception') {
            const exceptions = (0, models_1.getExceptions)();
            if (exceptions.length === 0) {
                console.log(chalk_1.default.green('✓ 没有异常记录'));
                return;
            }
            console.log(chalk_1.default.yellow(`\n异常记录（共 ${exceptions.length} 条）：`));
            const table = new cli_table3_1.default({
                head: [
                    chalk_1.default.cyan('时间'),
                    chalk_1.default.cyan('类型'),
                    chalk_1.default.cyan('严重度'),
                    chalk_1.default.cyan('消息'),
                    chalk_1.default.cyan('状态')
                ],
                colWidths: [20, 20, 10, 40, 8],
                wordWrap: true
            });
            exceptions.slice(0, limit).forEach(e => {
                let severity = chalk_1.default.cyan(e.severity);
                if (e.severity === 'critical')
                    severity = chalk_1.default.red(e.severity);
                if (e.severity === 'error')
                    severity = chalk_1.default.red(e.severity);
                if (e.severity === 'warning')
                    severity = chalk_1.default.yellow(e.severity);
                const status = e.is_resolved ? chalk_1.default.green('已解决') : chalk_1.default.red('未解决');
                table.push([
                    e.created_at,
                    e.exception_type,
                    severity,
                    e.message,
                    status
                ]);
            });
            console.log(table.toString());
            const unresolved = exceptions.filter(e => !e.is_resolved).length;
            if (unresolved > 0) {
                console.log(chalk_1.default.red(`\n⚠ 还有 ${unresolved} 条未解决的异常`));
            }
        }
        else if (type === 'import') {
            const logs = (0, models_1.getImportLogs)();
            if (logs.length === 0) {
                console.log(chalk_1.default.yellow('没有导入记录'));
                return;
            }
            console.log(chalk_1.default.cyan('\n导入历史：'));
            const table = new cli_table3_1.default({
                head: [
                    chalk_1.default.cyan('时间'),
                    chalk_1.default.cyan('文件'),
                    chalk_1.default.cyan('类型'),
                    chalk_1.default.cyan('总计'),
                    chalk_1.default.cyan('成功'),
                    chalk_1.default.cyan('失败'),
                    chalk_1.default.cyan('状态')
                ],
                colWidths: [20, 25, 10, 8, 8, 8, 15],
                wordWrap: true
            });
            logs.slice(0, limit).forEach(l => {
                let status = chalk_1.default.cyan(l.status);
                if (l.status === 'completed')
                    status = chalk_1.default.green(l.status);
                if (l.status === 'completed_with_errors')
                    status = chalk_1.default.yellow(l.status);
                if (l.status === 'failed')
                    status = chalk_1.default.red(l.status);
                table.push([
                    l.created_at,
                    path_1.default.basename(l.file_name),
                    l.file_type,
                    l.total_records,
                    l.success_count,
                    l.error_count,
                    status
                ]);
            });
            console.log(table.toString());
        }
        else {
            console.error(chalk_1.default.red(`无效的历史类型: ${type}`));
            console.error(chalk_1.default.yellow('有效值: budget, exception, import'));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('查看历史失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('resolve')
    .description('标记异常为已解决')
    .argument('<exception_id>', '异常 ID')
    .action((exceptionId) => {
    try {
        const exceptions = (0, models_1.getExceptions)();
        const exception = exceptions.find(e => e.id === exceptionId);
        if (!exception) {
            console.error(chalk_1.default.red(`找不到异常记录: ${exceptionId}`));
            process.exit(1);
        }
        if (exception.is_resolved) {
            console.log(chalk_1.default.yellow('该异常已经解决'));
            return;
        }
        (0, models_1.resolveException)(exceptionId);
        console.log(chalk_1.default.green('✓ 异常已标记为已解决'));
    }
    catch (error) {
        console.error(chalk_1.default.red('操作失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('report')
    .description('生成 Excel 报告')
    .option('-o, --output <path>', '输出文件路径')
    .action((options) => {
    try {
        const outputPath = options.output || `./budget_report_${Date.now()}.xlsx`;
        const absolutePath = path_1.default.resolve(outputPath);
        const data = (0, reportService_1.generateReportData)();
        console.log(chalk_1.default.cyan('正在生成报告...'));
        (0, reportService_1.generateExcelReport)(absolutePath);
        console.log(chalk_1.default.green('✓ 报告生成成功！'));
        console.log(chalk_1.default.cyan(`文件路径: ${absolutePath}`));
        console.log(chalk_1.default.cyan('\n报告概览：'));
        const summaryTable = new cli_table3_1.default({
            head: [chalk_1.default.cyan('项目'), chalk_1.default.cyan('数值')],
            colWidths: [20, 20]
        });
        summaryTable.push(['预算总数', data.summary.totalBudgets], ['超支预算', chalk_1.default.red(data.summary.overBudgetCount)], ['超阈值预算', chalk_1.default.yellow(data.summary.overThresholdCount)], ['采购申请数', data.summary.totalPurchaseRequests], ['付款记录数', data.summary.totalPayments], ['待处理异常', chalk_1.default.red(data.summary.pendingExceptions)]);
        console.log(summaryTable.toString());
        console.log(chalk_1.default.cyan('\n报告包含以下工作表：'));
        console.log(chalk_1.default.cyan('  • 概览 - 整体统计'));
        console.log(chalk_1.default.cyan('  • 预算状况 - 各部门预算使用情况'));
        console.log(chalk_1.default.cyan('  • 采购申请 - 所有采购记录'));
        console.log(chalk_1.default.cyan('  • 合同付款 - 所有付款记录'));
        console.log(chalk_1.default.cyan('  • 异常记录 - 所有异常信息'));
    }
    catch (error) {
        console.error(chalk_1.default.red('报告生成失败:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
    finally {
        (0, database_1.closeDatabase)();
    }
});
program
    .command('help [command]')
    .description('显示帮助信息')
    .action((cmd) => {
    if (cmd) {
        const command = program.commands.find(c => c.name() === cmd);
        if (command) {
            command.outputHelp();
        }
        else {
            console.error(chalk_1.default.red(`找不到命令: ${cmd}`));
            program.outputHelp();
        }
    }
    else {
        program.outputHelp();
        console.log(chalk_1.default.cyan('\n使用示例：'));
        console.log(chalk_1.default.cyan('  budget init                    # 初始化数据库'));
        console.log(chalk_1.default.cyan('  budget template -t budget      # 生成预算模板'));
        console.log(chalk_1.default.cyan('  budget import data.xlsx -t budget  # 导入预算数据'));
        console.log(chalk_1.default.cyan('  budget check                   # 检查预算状态'));
        console.log(chalk_1.default.cyan('  budget history -t exception    # 查看异常记录'));
        console.log(chalk_1.default.cyan('  budget report                  # 生成 Excel 报告'));
    }
});
program.parseAsync(process.argv).catch((error) => {
    console.error(chalk_1.default.red('发生错误:'), error.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map