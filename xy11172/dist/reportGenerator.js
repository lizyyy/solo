"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const chalk = require("chalk");
const Table = require("cli-table3");
class ReportGenerator {
    generateConsoleReport(summary) {
        let report = '';
        report += this.generateHeader();
        report += this.generateOverallSummary(summary);
        report += this.generateFileSummaries(summary.fileSummaries);
        report += this.generateErrorSummary(summary.errorSummary);
        report += this.generateFooter();
        return report;
    }
    generateHeader() {
        let header = '\n';
        header += chalk.cyan('╔══════════════════════════════════════════════════════════════╗\n');
        header += chalk.cyan('║') + '           ' + chalk.white.bold('社区诊疗车库存回库处理报告') + '                ' + chalk.cyan('║\n');
        header += chalk.cyan('╚══════════════════════════════════════════════════════════════╝\n');
        header += `\n处理时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        return header;
    }
    generateOverallSummary(summary) {
        const table = new Table({
            head: [
                chalk.cyan('统计项'),
                chalk.cyan('数量'),
                chalk.cyan('占比')
            ],
            colWidths: [20, 10, 15]
        });
        const total = summary.totalRecords;
        const successRate = total > 0 ? ((summary.totalSuccess / total) * 100).toFixed(1) : '0.0';
        const skippedRate = total > 0 ? ((summary.totalSkipped / total) * 100).toFixed(1) : '0.0';
        const failedRate = total > 0 ? ((summary.totalFailed / total) * 100).toFixed(1) : '0.0';
        table.push(['处理文件数', summary.totalFiles.toString(), '-'], ['总记录数', total.toString(), '100%'], [chalk.green('成功'), chalk.green(summary.totalSuccess.toString()), chalk.green(`${successRate}%`)], [chalk.yellow('跳过'), chalk.yellow(summary.totalSkipped.toString()), chalk.yellow(`${skippedRate}%`)], [chalk.red('失败'), chalk.red(summary.totalFailed.toString()), chalk.red(`${failedRate}%`)]);
        return '【总体统计】\n' + table.toString() + '\n\n';
    }
    generateFileSummaries(fileSummaries) {
        if (fileSummaries.length === 0)
            return '';
        const table = new Table({
            head: [
                chalk.cyan('文件名'),
                chalk.cyan('总数'),
                chalk.green('成功'),
                chalk.yellow('跳过'),
                chalk.red('失败')
            ],
            colWidths: [30, 8, 8, 8, 8]
        });
        for (const file of fileSummaries) {
            table.push([
                file.filename,
                file.totalRecords.toString(),
                chalk.green(file.successCount.toString()),
                chalk.yellow(file.skippedCount.toString()),
                chalk.red(file.failedCount.toString())
            ]);
        }
        return '【各文件处理情况】\n' + table.toString() + '\n\n';
    }
    generateErrorSummary(errorSummary) {
        let report = '【异常摘要】\n\n';
        let hasErrors = false;
        const errorTypes = [
            { key: '途中报损异常', title: '途中报损异常', icon: '⚠️' },
            { key: '批号拆分异常', title: '批号拆分异常', icon: '🔀' },
            { key: '数量不匹配', title: '数量不匹配', icon: '⚖️' },
            { key: '必填项缺失', title: '必填项缺失', icon: '📋' },
            { key: '数据校验失败', title: '数据校验失败', icon: '❌' }
        ];
        for (const errorType of errorTypes) {
            const errors = errorSummary[errorType.key];
            if (errors.length > 0) {
                hasErrors = true;
                report += this.generateErrorTypeSection(errorType, errors);
            }
        }
        if (!hasErrors) {
            report += chalk.green('  ✅ 无异常记录\n\n');
        }
        return report;
    }
    generateErrorTypeSection(errorType, errors) {
        let section = '';
        section += `  ${errorType.icon} ${chalk.red.bold(errorType.title)} (${errors.length}条)\n`;
        const table = new Table({
            head: [
                chalk.cyan('序号'),
                chalk.cyan('车辆'),
                chalk.cyan('药品'),
                chalk.cyan('错误信息'),
                chalk.cyan('修复建议')
            ],
            colWidths: [6, 12, 15, 35, 40],
            wordWrap: true
        });
        errors.slice(0, 5).forEach((error, index) => {
            table.push([
                (index + 1).toString(),
                error.车辆编号,
                error.药品名称 || error.药品编码,
                error.错误信息,
                chalk.yellow(error.修复建议)
            ]);
        });
        section += table.toString() + '\n';
        if (errors.length > 5) {
            section += `  ...还有 ${errors.length - 5} 条同类错误，请查看输出文件\n`;
        }
        section += '\n';
        return section;
    }
    generateFooter() {
        let footer = '';
        footer += chalk.cyan('══════════════════════════════════════════════════════════════\n');
        footer += chalk.white('输出文件说明：\n');
        footer += chalk.green('  - *_成功.csv') + ': 处理成功的记录\n';
        footer += chalk.yellow('  - *_跳过.csv') + ': 已处理或重复的记录\n';
        footer += chalk.red('  - *_失败.csv') + ': 处理失败的记录，含错误信息和修复建议\n';
        footer += chalk.blue('  - *_可复跑.csv') + ': 修正后可重新运行的记录格式\n';
        footer += chalk.cyan('══════════════════════════════════════════════════════════════\n');
        return footer;
    }
}
exports.ReportGenerator = ReportGenerator;
