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
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sampleData_1 = require("./sampleData");
const auditor_1 = require("./auditor");
const exporter_1 = require("./exporter");
const reviewTracker_1 = require("./reviewTracker");
const program = new commander_1.Command();
program
    .name('training-audit')
    .description('培训环境清单审核命令行工具')
    .version('1.0.0');
program
    .command('audit')
    .description('审核提交材料')
    .option('-i, --input <file>', '输入JSON文件路径，不指定则使用样例数据')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('-f, --format <type>', '输出格式: json|markdown|both', 'markdown')
    .option('-s, --submission <id>', '指定单个提交ID进行审核')
    .action(async (options) => {
    console.log(chalk_1.default.blue('=== 培训环境清单审核工具 ===\n'));
    let submissions = [];
    if (options.input) {
        try {
            const inputPath = path.resolve(options.input);
            const content = fs.readFileSync(inputPath, 'utf-8');
            submissions = JSON.parse(content);
            console.log(chalk_1.default.green(`✓ 已加载输入文件: ${inputPath}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`✗ 加载输入文件失败: ${error.message}`));
            process.exit(1);
        }
    }
    else {
        submissions = sampleData_1.allSubmissions;
        console.log(chalk_1.default.yellow('⚠  使用内置样例数据'));
    }
    if (options.submission) {
        submissions = submissions.filter(s => s.id === options.submission);
        if (submissions.length === 0) {
            console.log(chalk_1.default.red(`✗ 未找到提交ID: ${options.submission}`));
            process.exit(1);
        }
    }
    console.log(chalk_1.default.blue(`\n正在处理 ${submissions.length} 条提交记录...\n`));
    const batchResult = (0, auditor_1.batchAudit)(submissions);
    const report = {
        reportId: `RPT-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        totalProcessed: batchResult.results.length,
        interceptedCount: batchResult.results.filter(r => r.isIntercepted).length,
        approvedCount: batchResult.results.filter(r => !r.isIntercepted).length,
        results: batchResult.results,
        summary: batchResult.summary
    };
    console.log(chalk_1.default.green('✓ 处理完成\n'));
    console.log(chalk_1.default.cyan('=== 处理摘要 ==='));
    console.log(`- 总数: ${report.totalProcessed}`);
    console.log(`- 拦截: ${chalk_1.default.red(report.interceptedCount)}`);
    console.log(`- 通过: ${chalk_1.default.green(report.approvedCount)}`);
    console.log(`- 总耗时: ${report.summary.totalProcessingTime} ms`);
    console.log(`- 平均耗时: ${report.summary.averageProcessingTime.toFixed(2)} ms\n`);
    if (report.summary.topInterceptionReasons.length > 0) {
        console.log(chalk_1.default.magenta('=== 主要拦截原因 ==='));
        for (const item of report.summary.topInterceptionReasons) {
            console.log(`- ${item.reason}: ${item.count} 次`);
        }
        console.log('');
    }
    const outputDir = path.resolve(options.output);
    if (options.format === 'json' || options.format === 'both') {
        const jsonPath = (0, exporter_1.exportReport)(report, 'json', outputDir);
        console.log(chalk_1.default.green(`✓ JSON报告已保存: ${jsonPath}`));
    }
    if (options.format === 'markdown' || options.format === 'both') {
        const mdPath = (0, exporter_1.exportReport)(report, 'markdown', outputDir);
        console.log(chalk_1.default.green(`✓ Markdown报告已保存: ${mdPath}`));
    }
    console.log(chalk_1.default.blue('\n=== 审核完成 ==='));
});
program
    .command('review')
    .description('添加复核意见')
    .requiredOption('-s, --submission <id>', '提交记录ID')
    .requiredOption('-r, --reviewer <name>', '复核人姓名')
    .requiredOption('--rid, --reviewer-id <id>', '复核人ID')
    .requiredOption('-o, --opinion <type>', '意见: agree|disagree|need_more_info')
    .requiredOption('-c, --comments <text>', '评论内容')
    .option('-i, --input <file>', '输入报告JSON文件路径')
    .option('--output <dir>', '输出目录', './output')
    .action(async (options) => {
    console.log(chalk_1.default.blue('=== 添加复核意见 ===\n'));
    let report;
    if (options.input) {
        try {
            const inputPath = path.resolve(options.input);
            const content = fs.readFileSync(inputPath, 'utf-8');
            report = JSON.parse(content);
        }
        catch (error) {
            console.log(chalk_1.default.red(`✗ 加载报告文件失败: ${error.message}`));
            process.exit(1);
        }
    }
    else {
        const batchResult = (0, auditor_1.batchAudit)(sampleData_1.allSubmissions);
        report = {
            reportId: `RPT-${Date.now()}`,
            generatedAt: new Date().toISOString(),
            totalProcessed: batchResult.results.length,
            interceptedCount: batchResult.results.filter(r => r.isIntercepted).length,
            approvedCount: batchResult.results.filter(r => !r.isIntercepted).length,
            results: batchResult.results,
            summary: batchResult.summary
        };
    }
    const resultIndex = report.results.findIndex(r => r.submissionId === options.submission);
    if (resultIndex === -1) {
        console.log(chalk_1.default.red(`✗ 未找到提交记录: ${options.submission}`));
        process.exit(1);
    }
    const validOpinions = ['agree', 'disagree', 'need_more_info'];
    if (!validOpinions.includes(options.opinion)) {
        console.log(chalk_1.default.red(`✗ 无效的意见类型: ${options.opinion}，必须是: ${validOpinions.join(', ')}`));
        process.exit(1);
    }
    report.results[resultIndex] = (0, reviewTracker_1.addReviewOpinion)(report.results[resultIndex], options.reviewer, options.reviewerId, options.opinion, options.comments);
    const summary = (0, reviewTracker_1.getReviewSummary)(report.results[resultIndex]);
    console.log(chalk_1.default.green('✓ 复核意见已添加\n'));
    console.log(chalk_1.default.cyan('=== 复核摘要 ==='));
    console.log(`- 总意见数: ${summary.totalOpinions}`);
    console.log(`- 同意: ${summary.agreeCount}`);
    console.log(`- 不同意: ${summary.disagreeCount}`);
    console.log(`- 需要更多信息: ${summary.needMoreInfoCount}`);
    console.log(`- 最终建议: ${summary.finalRecommendation}\n`);
    const outputDir = path.resolve(options.output);
    const jsonPath = (0, exporter_1.exportReport)(report, 'json', outputDir);
    const mdPath = (0, exporter_1.exportReport)(report, 'markdown', outputDir);
    console.log(chalk_1.default.green(`✓ 报告已更新: ${jsonPath}`));
    console.log(chalk_1.default.green(`✓ 报告已更新: ${mdPath}`));
});
program
    .command('sample')
    .description('生成样例数据文件')
    .option('-o, --output <file>', '输出文件路径', './sample-data.json')
    .action(async (options) => {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(sampleData_1.allSubmissions, null, 2), 'utf-8');
    console.log(chalk_1.default.green(`✓ 样例数据已保存: ${outputPath}`));
    console.log(chalk_1.default.blue(`包含 ${sampleData_1.allSubmissions.length} 条记录，其中1条会触发拦截`));
});
program.parseAsync(process.argv);
