#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk = require("chalk");
const constants_1 = require("./constants");
const config_1 = require("./config");
const scanner_1 = require("./scanner");
const analyzer_1 = require("./analyzer");
const reporter_1 = require("./reporter");
const validator_1 = require("./validator");
const self_check_1 = require("./self-check");
const program = new commander_1.Command();
program
    .name('flag-cleaner')
    .description('Feature Flag 死码检测 CLI 工具 - 扫描代码库中的废弃 feature flag')
    .version(constants_1.VERSION);
program
    .command('scan')
    .description('扫描源码目录中的 feature flag 使用情况')
    .requiredOption('-f, --flags <path>', 'Flag 定义 JSON 文件路径')
    .requiredOption('-s, --source <dir>', '源码目录路径')
    .option('-o, --output <dir>', '报告输出目录', './flag-cleaner-output')
    .option('-e, --exclude <patterns>', '排除的文件模式 (逗号分隔)')
    .option('-i, --include <patterns>', '包含的文件模式 (逗号分隔)')
    .option('-l, --languages <list>', '扫描的语言 (typescript,javascript,python,go,java,kotlin,swift,rust,other)')
    .option('-d, --default <boolean>', '假设的默认值 (true/false)', 'true')
    .option('--format <formats>', '输出格式 (all,terminal,json,markdown)', 'all')
    .option('-q, --quiet', '安静模式，不输出终端报告', false)
    .option('-v, --verbose', '详细模式，输出完整报告', false)
    .action(async (options) => {
    try {
        const validationErrors = (0, validator_1.validateInput)(options);
        if ((0, validator_1.hasCriticalErrors)(validationErrors)) {
            console.error(chalk.red('输入验证失败:'));
            console.error((0, validator_1.formatValidationErrors)(validationErrors));
            process.exit(constants_1.EXIT_CODES.VALIDATION_ERROR);
        }
        const flagDefinitions = (0, config_1.loadFlagDefinitions)(options.flags);
        console.log(chalk.cyan(`加载了 ${flagDefinitions.length} 个 flag 定义`));
        const scanOptions = (0, config_1.mergeScanOptions)({
            sourceDir: options.source,
            flagDefinitions,
            outputDir: options.output,
            excludePatterns: (0, config_1.parsePatterns)(options.exclude),
            includePatterns: (0, config_1.parsePatterns)(options.include),
            languages: (0, config_1.parseLanguages)(options.languages),
            defaultAssumedValue: options.default,
        });
        (0, config_1.ensureOutputDir)(scanOptions.outputDir);
        console.log(chalk.cyan(`开始扫描目录: ${scanOptions.sourceDir}`));
        const startTime = Date.now();
        const { matches, filesScanned, errors } = await (0, scanner_1.scanSourceFiles)(scanOptions);
        console.log(chalk.cyan(`扫描完成，分析中...`));
        const result = (0, analyzer_1.analyzeAllFlags)(flagDefinitions, matches, scanOptions, filesScanned, errors, startTime);
        const formats = options.format.split(',').map(f => f.trim().toLowerCase());
        const reportConfig = {
            terminal: !options.quiet && (formats.includes('all') || formats.includes('terminal')),
            json: formats.includes('all') || formats.includes('json'),
            markdown: formats.includes('all') || formats.includes('markdown'),
            outputDir: scanOptions.outputDir,
            baseName: 'flag-cleaner-report',
        };
        const outputPaths = await (0, reporter_1.writeReports)(result, reportConfig);
        if (reportConfig.terminal) {
            console.log((0, reporter_1.generateTerminalSummary)(result, options.verbose));
        }
        if (outputPaths.jsonPath) {
            console.log(chalk.gray(`JSON 报告: ${outputPaths.jsonPath}`));
        }
        if (outputPaths.markdownPath) {
            console.log(chalk.gray(`Markdown 报告: ${outputPaths.markdownPath}`));
        }
        if (result.summary.flagsWithRisk > 0) {
            process.exit(constants_1.EXIT_CODES.FLAGS_WITH_HIGH_RISK);
        }
        else {
            process.exit(constants_1.EXIT_CODES.SUCCESS);
        }
    }
    catch (error) {
        console.error(chalk.red(`扫描失败: ${error.message}`));
        if (program.opts().verbose) {
            console.error(error.stack);
        }
        process.exit(constants_1.EXIT_CODES.SCAN_ERROR);
    }
});
program
    .command('self-check')
    .description('运行自检，验证工具功能正常')
    .option('-v, --verbose', '详细模式', false)
    .action(async (options) => {
    console.log(chalk.cyan('🧪 开始自检...'));
    console.log('');
    const results = await (0, self_check_1.runSelfCheck)();
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    results.forEach(result => {
        const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
        console.log(`${status} ${result.name}`);
        if (!result.passed || options.verbose) {
            console.log(`    ${result.message}`);
            if (result.details && options.verbose) {
                console.log(`    详情: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n    ')}`);
            }
        }
    });
    console.log('');
    if (passed === total) {
        console.log(chalk.green(`✅ 所有 ${total} 项自检通过!`));
        process.exit(constants_1.EXIT_CODES.SUCCESS);
    }
    else {
        console.log(chalk.red(`❌ ${total - passed}/${total} 项自检失败`));
        process.exit(constants_1.EXIT_CODES.SELF_CHECK_FAILED);
    }
});
program.parseAsync(process.argv).catch(error => {
    console.error(chalk.red(`错误: ${error.message}`));
    process.exit(constants_1.EXIT_CODES.SCAN_ERROR);
});
//# sourceMappingURL=cli.js.map