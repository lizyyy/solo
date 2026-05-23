"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeOutput = writeOutput;
// @ts-ignore
const XLSX = require('xlsx');
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
function writeOutput(result, outputDir) {
    console.log(chalk_1.default.blue('\n📝 正在生成输出文件...'));
    const timestamp = new Date().toISOString().slice(0, 10);
    writeSummary(result);
    writeJSON(result, path_1.default.join(outputDir, `合并结果_${timestamp}.json`));
    writeExcelReport(result, path_1.default.join(outputDir, `合并报告_${timestamp}.xlsx`));
    console.log(chalk_1.default.green(`\n✅ 所有文件已输出到: ${outputDir}`));
}
function writeSummary(result) {
    console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
    console.log(chalk_1.default.cyan('📊 合并结果摘要'));
    console.log(chalk_1.default.cyan('='.repeat(60)));
    console.log('\n📈 统计数据:');
    console.log(chalk_1.default.gray(`  原始来访记录数: ${chalk_1.default.white(result.统计.原始来访记录数)}`));
    console.log(chalk_1.default.gray(`  原始渠道记录数: ${chalk_1.default.white(result.统计.原始渠道记录数)}`));
    console.log(chalk_1.default.gray(`  有效来访记录数: ${chalk_1.default.green(result.统计.有效来访记录数)}`));
    console.log(chalk_1.default.gray(`  有效渠道记录数: ${chalk_1.default.green(result.统计.有效渠道记录数)}`));
    console.log(chalk_1.default.gray(`  合并后客户数: ${chalk_1.default.white(result.统计.合并后客户数)}`));
    console.log(chalk_1.default.gray(`  重复认领客户数: ${chalk_1.default.yellow(result.统计.重复认领客户数)}`));
    console.log(chalk_1.default.gray(`  坏记录数: ${chalk_1.default.red(result.统计.坏记录数)}`));
    if (result.统计.重复认领客户数 > 0) {
        console.log('\n⚠️  重复认领客户 Top 5:');
        const duplicates = result.合并记录
            .filter(r => r.是否重复认领)
            .slice(0, 5);
        duplicates.forEach((record, i) => {
            console.log(chalk_1.default.yellow(`  ${i + 1}. ${record.客户姓名} (${record.归一化电话})`));
            console.log(chalk_1.default.gray(`     渠道: ${record.重复认领渠道.join(', ')}`));
            console.log(chalk_1.default.gray(`     顾问: ${record.重复认领顾问.join(', ')}`));
        });
    }
    console.log('\n👥 顾问业绩 Top 5:');
    result.顾问汇总.slice(0, 5).forEach((advisor, i) => {
        const dupInfo = advisor.重复认领数 > 0 ? chalk_1.default.yellow(` (含${advisor.重复认领数}个重复)`) : '';
        console.log(chalk_1.default.green(`  ${i + 1}. ${advisor.置业顾问}: ${advisor.认领客户数} 个客户${dupInfo}`));
    });
    console.log('\n🏷️  渠道统计 Top 5:');
    result.渠道汇总.slice(0, 5).forEach((channel, i) => {
        const dupInfo = channel.重复认领数 > 0 ? chalk_1.default.yellow(` (含${channel.重复认领数}个重复)`) : '';
        console.log(chalk_1.default.green(`  ${i + 1}. ${channel.渠道名称}: ${channel.认领客户数} 个客户${dupInfo}`));
    });
    if (result.坏记录.length > 0) {
        console.log(chalk_1.default.red('\n❌ 坏记录详情:'));
        result.坏记录.forEach((bad, i) => {
            console.log(chalk_1.default.red(`  ${i + 1}. [${bad.来源文件}] 第${bad.原始行号}行: ${bad.错误原因}`));
        });
    }
    console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
}
function writeJSON(result, filePath) {
    const data = {
        生成时间: new Date().toISOString(),
        统计: result.统计,
        合并记录: result.合并记录.map(r => ({
            归一化电话: r.归一化电话,
            客户姓名: r.客户姓名,
            最终渠道: r.最终渠道,
            最终置业顾问: r.最终置业顾问,
            最终认领状态: r.最终认领状态,
            首次来访日期: r.首次来访日期,
            来访次数: r.来访次数,
            涉及渠道数量: r.涉及渠道数量,
            涉及顾问数量: r.涉及顾问数量,
            是否重复认领: r.是否重复认领,
            重复认领渠道: r.重复认领渠道,
            重复认领顾问: r.重复认领顾问,
            原始来访记录行号: r.原始来访记录行号,
            原始渠道记录行号: r.原始渠道记录行号
        })),
        顾问汇总: result.顾问汇总,
        渠道汇总: result.渠道汇总,
        坏记录: result.坏记录
    };
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(chalk_1.default.green(`  ✅ JSON结果已保存: ${path_1.default.basename(filePath)}`));
}
function writeExcelReport(result, filePath) {
    const workbook = XLSX.utils.book_new();
    const summaryData = [
        ['统计项', '数值'],
        ['原始来访记录数', result.统计.原始来访记录数],
        ['原始渠道记录数', result.统计.原始渠道记录数],
        ['有效来访记录数', result.统计.有效来访记录数],
        ['有效渠道记录数', result.统计.有效渠道记录数],
        ['合并后客户数', result.统计.合并后客户数],
        ['重复认领客户数', result.统计.重复认领客户数],
        ['坏记录数', result.统计.坏记录数],
        ['生成时间', new Date().toLocaleString()]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryData), '统计摘要');
    const mergedHeaders = [
        '归一化电话', '客户姓名', '最终渠道', '最终置业顾问', '最终认领状态',
        '首次来访日期', '来访次数', '涉及渠道数量', '涉及顾问数量', '是否重复认领',
        '重复认领渠道', '重复认领顾问', '原始来访记录行号', '原始渠道记录行号'
    ];
    const mergedData = [mergedHeaders, ...result.合并记录.map(r => [
            r.归一化电话, r.客户姓名, r.最终渠道, r.最终置业顾问, r.最终认领状态,
            r.首次来访日期 || '', r.来访次数, r.涉及渠道数量, r.涉及顾问数量,
            r.是否重复认领 ? '是' : '否',
            r.重复认领渠道.join('; '),
            r.重复认领顾问.join('; '),
            r.原始来访记录行号.join(', '),
            r.原始渠道记录行号.join(', ')
        ])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mergedData), '合并结果');
    const duplicateData = [
        ['序号', '电话', '客户姓名', '重复渠道', '重复顾问', '来访记录行号', '渠道记录行号'],
        ...result.合并记录
            .filter(r => r.是否重复认领)
            .map((r, i) => [
            i + 1, r.归一化电话, r.客户姓名,
            r.重复认领渠道.join('; '),
            r.重复认领顾问.join('; '),
            r.原始来访记录行号.join(', '),
            r.原始渠道记录行号.join(', ')
        ])
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(duplicateData), '重复认领清单');
    const advisorHeaders = ['置业顾问', '认领客户数', '重复认领数', '涉及渠道'];
    const advisorData = [advisorHeaders, ...result.顾问汇总.map(a => [
            a.置业顾问, a.认领客户数, a.重复认领数, a.涉及渠道.join('; ')
        ])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(advisorData), '顾问汇总');
    const channelHeaders = ['渠道名称', '认领客户数', '重复认领数', '涉及顾问'];
    const channelData = [channelHeaders, ...result.渠道汇总.map(c => [
            c.渠道名称, c.认领客户数, c.重复认领数, c.涉及顾问.join('; ')
        ])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(channelData), '渠道汇总');
    const badHeaders = ['来源文件', '原始行号', '错误原因', '原始数据'];
    const badData = [badHeaders, ...result.坏记录.map(b => [
            b.来源文件, b.原始行号, b.错误原因, JSON.stringify(b.原始数据)
        ])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(badData), '坏记录');
    XLSX.writeFile(workbook, filePath);
    console.log(chalk_1.default.green(`  ✅ Excel报告已保存: ${path_1.default.basename(filePath)}`));
}
