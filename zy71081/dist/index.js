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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const config_parser_1 = require("./config-parser");
const trace_parser_1 = require("./trace-parser");
const sampling_engine_1 = require("./sampling-engine");
const report_generator_1 = require("./report-generator");
const types_1 = require("./types");
const chalk = require("chalk");
const program = new commander_1.Command();
program
    .name('otel-sampling')
    .description('OpenTelemetry 采样诊断 CLI 工具')
    .version('1.0.0')
    .requiredOption('-c, --config <path>', '采样配置文件路径 (JSON)')
    .requiredOption('-t, --traces <path>', 'Trace 样本文件路径 (JSON)')
    .option('-s, --service <name>', '只分析指定服务的 trace')
    .option('-b, --budget <number>', '覆盖全局预算阈值 (每秒采样数)', (v) => parseInt(v, 10))
    .option('-o, --output <dir>', '输出目录', './output')
    .option('-f, --format <format>', '输出格式: json, markdown, both', 'both')
    .option('-v, --verbose', '显示详细信息')
    .option('-q, --quiet', '静默模式，不输出终端摘要')
    .option('--seed <number>', '随机数种子 (用于可复现的采样结果)', (v) => parseInt(v, 10), 42)
    .option('--no-deterministic', '禁用确定性模式 (使用真实随机数)')
    .parse(process.argv);
const options = program.opts();
function validateOptions(options) {
    const errors = [];
    if (!path.isAbsolute(options.config) && !options.config.startsWith('.')) {
        options.config = path.resolve(process.cwd(), options.config);
    }
    if (!path.isAbsolute(options.traces) && !options.traces.startsWith('.')) {
        options.traces = path.resolve(process.cwd(), options.traces);
    }
    if (!path.isAbsolute(options.output) && !options.output.startsWith('.')) {
        options.output = path.resolve(process.cwd(), options.output);
    }
    const validFormats = ['json', 'markdown', 'both'];
    if (!validFormats.includes(options.format)) {
        errors.push(`无效的输出格式: ${options.format}，必须是 ${validFormats.join(', ')} 之一`);
    }
    if (options.budget !== undefined && (isNaN(options.budget) || options.budget < 0)) {
        errors.push('预算阈值必须是非负数字');
    }
    return { valid: errors.length === 0, errors };
}
function calculateExitCode(report, configValid) {
    if (!configValid || report.configValidation.errors.length > 0) {
        return types_1.ExitCode.VALIDATION_ERROR;
    }
    if (report.traceAnalysis.totalTraces === 0) {
        return types_1.ExitCode.INPUT_ERROR;
    }
    const budgetExhausted = (report.budgetAnalysis.globalBudget?.exhausted) ||
        Object.values(report.budgetAnalysis.ruleBudgets).some(b => b.exhausted);
    if (budgetExhausted) {
        return types_1.ExitCode.BUDGET_EXCEEDED;
    }
    const dropRate = report.samplingResults.summary.droppedPercentage;
    if (dropRate > 50) {
        return types_1.ExitCode.TRACES_DROPPED;
    }
    return types_1.ExitCode.SUCCESS;
}
async function main() {
    const validation = validateOptions(options);
    if (!validation.valid) {
        console.error(chalk.red('参数校验失败:'));
        for (const error of validation.errors) {
            console.error(chalk.red(`  • ${error}`));
        }
        process.exit(types_1.ExitCode.VALIDATION_ERROR);
    }
    if (!options.quiet) {
        console.log(chalk.cyan('\n🔍 开始分析采样配置...'));
    }
    const configParser = new config_parser_1.ConfigParser();
    const config = configParser.parse(options.config);
    const configValid = configParser.isValid();
    const configValidation = {
        valid: configValid,
        errors: configParser.getErrors(),
        warnings: configParser.getWarnings()
    };
    if (!config) {
        console.error(chalk.red('\n❌ 配置解析失败，无法继续'));
        process.exit(types_1.ExitCode.VALIDATION_ERROR);
    }
    if (!options.quiet) {
        console.log(chalk.green(`  ✓ 配置解析完成，发现 ${config.rules.length} 条规则`));
        console.log(chalk.cyan('\n📂 解析 Trace 样本...'));
    }
    const traceParser = new trace_parser_1.TraceParser();
    const traceResult = traceParser.parse(options.traces, options.service);
    if (traceResult.errors.length > 0) {
        console.error(chalk.red('\n❌ Trace 解析失败:'));
        for (const error of traceResult.errors) {
            console.error(chalk.red(`  • [${error.field}] ${error.message}`));
        }
        process.exit(types_1.ExitCode.INPUT_ERROR);
    }
    const traceAnalysis = {
        totalTraces: traceResult.traces.length,
        totalSpans: traceResult.traces.reduce((sum, t) => sum + t.spans.length, 0),
        uniqueServices: [...new Set(traceResult.traces.flatMap(t => t.serviceNames))],
        missingFields: traceResult.missingFields,
        fieldCaseIssues: traceResult.fieldCaseIssues
    };
    if (!options.quiet) {
        console.log(chalk.green(`  ✓ 解析完成，发现 ${traceResult.traces.length} 条 trace, ${traceAnalysis.totalSpans} 个 span`));
        console.log(chalk.green(`  ✓ 涉及 ${traceAnalysis.uniqueServices.length} 个服务`));
        console.log(chalk.cyan('\n⚙️  执行采样规则匹配...'));
    }
    const samplingEngine = new sampling_engine_1.SamplingEngine(config, options.budget, options.seed, options.deterministic);
    const samplingResults = traceResult.traces.map(trace => samplingEngine.evaluateTrace(trace));
    const budgetStats = samplingEngine.getBudgetStats();
    if (!options.quiet) {
        console.log(chalk.green(`  ✓ 匹配完成，评估 ${samplingResults.length} 条 trace`));
        console.log(chalk.cyan('\n📝 生成诊断报告...'));
    }
    const reportGenerator = new report_generator_1.ReportGenerator(options);
    const report = reportGenerator.generateReport(configValidation, traceAnalysis, samplingResults, budgetStats, traceResult.traces);
    if (options.format === 'json' || options.format === 'both') {
        const jsonPath = reportGenerator.writeJsonReport(report);
        if (!options.quiet) {
            console.log(chalk.green(`  ✓ JSON 报告已写入: ${jsonPath}`));
        }
    }
    if (options.format === 'markdown' || options.format === 'both') {
        const mdPath = reportGenerator.writeMarkdownReport(report);
        if (!options.quiet) {
            console.log(chalk.green(`  ✓ Markdown 报告已写入: ${mdPath}`));
        }
    }
    reportGenerator.printTerminalSummary(report);
    const exitCode = calculateExitCode(report, configValid);
    process.exit(exitCode);
}
main().catch(error => {
    console.error(chalk.red('\n💥 未预期的错误:'), error);
    process.exit(types_1.ExitCode.PROCESSING_ERROR);
});
//# sourceMappingURL=index.js.map