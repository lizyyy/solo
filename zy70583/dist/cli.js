#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const parser_1 = require("./parser");
const denoiser_1 = require("./denoiser");
const reporter_1 = require("./reporter");
const self_test_1 = require("./self-test");
const program = new commander_1.Command();
program
    .name('alert-denoiser')
    .description('Alert规则消噪CLI - 解析、校验和报告告警噪声')
    .version('1.0.0');
program
    .command('analyze')
    .description('分析告警数据并生成消噪报告')
    .option('-a, --alerts <path>', '告警历史数据文件 (JSON/CSV)')
    .option('-r, --rules <path>', '规则配置文件 (JSON/CSV)')
    .option('-s, --silences <path>', '静默配置文件 (JSON/CSV)')
    .option('-o, --output <dir>', '输出目录，默认为 ./output')
    .option('-f, --format <type>', '输出格式: terminal|json|markdown|all', 'all')
    .option('-t, --threshold <number>', '噪声评分阈值，默认50', parseInt)
    .action(async (options) => {
    try {
        await runAnalysis(options);
    }
    catch (e) {
        console.error('❌ 分析失败:', e.message);
        process.exit(1);
    }
});
program
    .command('self-test')
    .description('运行自检，验证解析、边界样本和报告生成功能')
    .action(async () => {
    try {
        const tester = new self_test_1.SelfTester();
        const success = await tester.runAllTests();
        process.exit(success ? 0 : 1);
    }
    catch (e) {
        console.error('❌ 自检失败:', e.message);
        process.exit(1);
    }
});
program.parseAsync(process.argv);
async function runAnalysis(options) {
    const parser = new parser_1.DataParser();
    console.log('📥 正在解析数据...');
    const alerts = options.alerts ? parser.parseAlerts(options.alerts) : [];
    const rules = options.rules ? parser.parseRules(options.rules) : [];
    const silences = options.silences ? parser.parseSilences(options.silences) : [];
    const parseErrors = parser.getParseErrors();
    if (alerts.length === 0 && rules.length === 0) {
        console.warn('⚠️ 警告: 未解析到有效的告警或规则数据');
    }
    console.log(`   告警: ${alerts.length} 条`);
    console.log(`   规则: ${rules.length} 条`);
    console.log(`   静默: ${silences.length} 条`);
    console.log(`   错误: ${parseErrors.length} 个`);
    console.log('');
    console.log('⚙️  正在进行消噪分析...');
    const denoiser = new denoiser_1.Denoiser(alerts, rules, silences, options.threshold || 50);
    const aggregations = denoiser.aggregateAlerts();
    const matchedSilences = denoiser.matchSilences(aggregations);
    const noiseScores = denoiser.calculateNoiseScores(aggregations);
    const candidates = denoiser.generateCandidates(noiseScores, matchedSilences);
    const result = {
        metadata: {
            generatedAt: Date.now(),
            inputFiles: {
                alerts: options.alerts,
                rules: options.rules,
                silences: options.silences,
            },
            totalAlerts: alerts.length,
            totalRules: rules.length,
            totalSilences: silences.length,
        },
        aggregations,
        noiseScores,
        matchedSilences,
        candidates,
        parseErrors,
    };
    const reporter = new reporter_1.Reporter(result);
    const outputDir = options.output || './output';
    console.log('📝 正在生成报告...');
    console.log('');
    const format = options.format || 'all';
    if (format === 'terminal' || format === 'all') {
        console.log(reporter.generateTerminalSummary());
    }
    if (format === 'json' || format === 'all') {
        reporter.saveJsonReport(`${outputDir}/denoise-result.json`);
        console.log(`✅ JSON结果已保存: ${outputDir}/denoise-result.json`);
    }
    if (format === 'markdown' || format === 'all') {
        reporter.saveMarkdownReport(`${outputDir}/denoise-report.md`);
        console.log(`✅ Markdown报告已保存: ${outputDir}/denoise-report.md`);
    }
    if (format === 'all') {
        console.log('');
        console.log('🎉 分析完成！报告已生成到 output 目录');
    }
}
