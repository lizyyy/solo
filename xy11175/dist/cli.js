#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const parser_1 = require("./parser");
const validator_1 = require("./validator");
const reporter_1 = require("./reporter");
const program = new commander_1.Command();
program
    .name('tea-inspection')
    .description('茶饮加盟巡店组茶饮门店扣分 CLI 工具')
    .version('1.0.0')
    .requiredOption('-i, --input <path>', '输入 JSON 文件路径')
    .option('-o, --output <path>', '输出 JSON 报告路径')
    .option('-t, --text-report <path>', '输出文本报告路径')
    .option('--idempotent', '可复跑模式（输出稳定排序，便于 diff 比较)')
    .parse(process.argv);
const options = program.opts();
async function main() {
    try {
        console.log('📋 茶饮加盟巡店组 - 门店扣分检查工具');
        console.log(`📁 输入文件: ${options.input}`);
        console.log('');
        const parser = new parser_1.InspectionParser();
        const inspections = parser.parseFile(options.input);
        console.log(`✅ 成功解析 ${inspections.length} 条巡检数据`);
        const sortedInspections = parser.sortInspections(inspections);
        console.log('✅ 数据排序完成');
        const validator = new validator_1.InspectionValidator();
        const validationResult = validator.validate(sortedInspections);
        console.log(`✅ 校验完成 - 发现 ${validationResult.summary.totalErrors} 个异常`);
        console.log(`   - 照片复用: ${validationResult.summary.photoReuseCount}`);
        console.log(`   - 逾期整改: ${validationResult.summary.overdueCount}`);
        console.log(`   - 数据异常: ${validationResult.summary.invalidDataCount}`);
        console.log('');
        const reporter = new reporter_1.ReportGenerator();
        const jsonReport = reporter.generateJsonReport(inspections, validationResult, sortedInspections);
        if (options.idempotent) {
            jsonReport.generatedAt = '2024-01-01T00:00:00.000Z';
            jsonReport.runId = 'run_idempotent';
        }
        if (options.output) {
            reporter.saveReport(jsonReport, options.output);
            console.log(`💾 JSON 报告已保存: ${options.output}`);
        }
        if (options.textReport) {
            const textContent = reporter.generateTextReport(sortedInspections, validationResult);
            reporter.saveTextReport(textContent, options.textReport);
            console.log(`💾 文本报告已保存: ${options.textReport}`);
        }
        if (!options.output && !options.textReport) {
            const textContent = reporter.generateTextReport(sortedInspections, validationResult);
            console.log(textContent);
        }
        console.log('');
        console.log('🎉 处理完成!');
    }
    catch (error) {
        console.error('❌ 处理失败:', error.message);
        process.exit(1);
    }
}
main();
