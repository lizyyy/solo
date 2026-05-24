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
exports.runCli = runCli;
const commander_1 = require("commander");
const Joi = __importStar(require("joi"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const bounce_parser_1 = require("./core/bounce-parser");
const report_generator_1 = require("./core/report-generator");
const output_handler_1 = require("./core/output-handler");
const self_check_1 = require("./core/self-check");
const default_1 = require("./config/default");
const program = new commander_1.Command();
const optionsSchema = Joi.object({
    input: Joi.string(),
    inputDir: Joi.string(),
    recipient: Joi.string(),
    smtpCode: Joi.string(),
    provider: Joi.string(),
    batchId: Joi.string(),
    outputDir: Joi.string().default(default_1.defaultConfig.output.defaultDir),
    format: Joi.array().items(Joi.string().valid('json', 'markdown', 'summary', 'all')).default(['summary']),
    config: Joi.string(),
    verbose: Joi.boolean().default(false)
}).xor('input', 'inputDir', 'recipient');
async function runCli() {
    program
        .name('bounce-analyzer')
        .description('📧 邮件退信归因 CLI 工具 - 分析退信原因、分类统计、生成报告')
        .version('1.0.0');
    program
        .command('analyze')
        .description('分析退信数据并生成报告')
        .option('-i, --input <file>', '输入退信邮件文件 (.eml 或 .txt)')
        .option('-d, --input-dir <dir>', '批量分析目录下的所有邮件文件')
        .option('-r, --recipient <email>', '指定收件人邮箱（配合其他参数使用）')
        .option('-s, --smtp-code <code>', '指定 SMTP 状态码')
        .option('-p, --provider <name>', '指定邮件供应商 (tencent, alibaba, netease, gmail)')
        .option('-b, --batch-id <id>', '指定批次号')
        .option('-o, --output-dir <dir>', '输出目录', default_1.defaultConfig.output.defaultDir)
        .option('-f, --format <formats...>', '输出格式 (json, markdown, summary, all)', ['summary'])
        .option('-c, --config <file>', '配置文件路径')
        .option('-v, --verbose', '显示详细日志')
        .action(async (options) => {
        process.exit(await handleAnalyzeCommand(options));
    });
    program
        .command('selfcheck')
        .description('🧪 运行自检命令，验证解析器和边界情况')
        .option('-o, --output-dir <dir>', '输出目录', './selfcheck-results')
        .action(async (options) => {
        process.exit(await handleSelfCheckCommand(options));
    });
    program
        .command('parse')
        .description('解析单个邮件文件并显示详细信息')
        .argument('<file>', '邮件文件路径')
        .action(async (file) => {
        process.exit(await handleParseCommand(file));
    });
    program.parse(process.argv);
    if (process.argv.length <= 2) {
        program.outputHelp();
        return 0;
    }
    return 0;
}
async function handleAnalyzeCommand(options) {
    try {
        const { error, value } = optionsSchema.validate(options);
        if (error) {
            console.error(chalk_1.default.red(`❌ 参数错误: ${error.message}`));
            return 1;
        }
        const opts = value;
        const parser = new bounce_parser_1.BounceParser();
        const reportGenerator = new report_generator_1.ReportGenerator();
        const outputHandler = new output_handler_1.OutputHandler(opts.outputDir);
        let records = [];
        if (opts.input) {
            if (!fs.existsSync(opts.input)) {
                console.error(chalk_1.default.red(`❌ 输入文件不存在: ${opts.input}`));
                return 1;
            }
            const record = await parser.parseEmailFile(opts.input);
            records.push(record);
        }
        if (opts.inputDir) {
            if (!fs.existsSync(opts.inputDir)) {
                console.error(chalk_1.default.red(`❌ 输入目录不存在: ${opts.inputDir}`));
                return 1;
            }
            records = await parser.parseDirectory(opts.inputDir);
        }
        if (opts.recipient) {
            const record = parser.parseBounceData({
                recipient: opts.recipient,
                smtpCode: opts.smtpCode,
                provider: opts.provider,
                batchId: opts.batchId,
                rawMessage: ''
            });
            records.push(record);
        }
        if (records.length === 0) {
            console.error(chalk_1.default.yellow('⚠️  没有解析到任何退信记录'));
            return 0;
        }
        if (opts.verbose) {
            console.log(chalk_1.default.gray(`📝 解析到 ${records.length} 条退信记录`));
        }
        const report = reportGenerator.generateReport(records);
        const formats = opts.format.includes('all')
            ? ['json', 'markdown', 'summary']
            : opts.format;
        const outputFiles = [];
        if (formats.includes('summary')) {
            outputHandler.printConsoleSummary(records, report);
        }
        if (formats.includes('json')) {
            const jsonPath = outputHandler.writeJsonReport(report);
            const detailedPath = outputHandler.writeDetailedJson(records);
            outputFiles.push(jsonPath, detailedPath);
        }
        if (formats.includes('markdown')) {
            const mdPath = outputHandler.writeMarkdownReport(report, records);
            const retryPath = outputHandler.writeRetryList(records);
            const suppressPath = outputHandler.writeSuppressionList(records);
            outputFiles.push(mdPath, retryPath, suppressPath);
        }
        if (outputFiles.length > 0) {
            console.log(chalk_1.default.green('\n✅ 输出文件已生成:'));
            for (const file of outputFiles) {
                console.log(chalk_1.default.gray(`   - ${path.resolve(file)}`));
            }
        }
        return 0;
    }
    catch (e) {
        console.error(chalk_1.default.red(`❌ 执行失败: ${e.message}`));
        console.error(chalk_1.default.gray(e.stack || ''));
        return 1;
    }
}
async function handleSelfCheckCommand(options) {
    console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
    console.log(chalk_1.default.cyan.bold('🧪 邮件退信分析器 - 自检模式'));
    console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
    const selfCheck = new self_check_1.SelfCheck(options.outputDir);
    const results = await selfCheck.runAllTests();
    let passed = 0;
    let failed = 0;
    console.log(chalk_1.default.yellow.bold('📋 测试结果:'));
    console.log(chalk_1.default.gray('-'.repeat(60)));
    for (const result of results) {
        const status = result.passed
            ? chalk_1.default.green('✓ PASS')
            : chalk_1.default.red('✗ FAIL');
        if (result.passed)
            passed++;
        else
            failed++;
        console.log(`  ${status} ${result.name}`);
        if (!result.passed && result.error) {
            console.log(chalk_1.default.gray(`     ${result.error}`));
        }
    }
    console.log(chalk_1.default.gray('-'.repeat(60)));
    console.log(`\n  总计: ${chalk_1.default.white.bold(results.length)} 测试`);
    console.log(`  通过: ${chalk_1.default.green.bold(passed)}`);
    console.log(`  失败: ${chalk_1.default.red.bold(failed)}\n`);
    if (failed > 0) {
        console.log(chalk_1.default.red('❌ 自检失败，请检查上述错误信息'));
        return 1;
    }
    else {
        console.log(chalk_1.default.green('✅ 所有测试通过！解析器工作正常。'));
        console.log(chalk_1.default.gray(`   测试报告已输出到: ${options.outputDir}`));
        return 0;
    }
}
async function handleParseCommand(file) {
    try {
        if (!fs.existsSync(file)) {
            console.error(chalk_1.default.red(`❌ 文件不存在: ${file}`));
            return 1;
        }
        const parser = new bounce_parser_1.BounceParser();
        const record = await parser.parseEmailFile(file);
        console.log(chalk_1.default.cyan('\n' + '='.repeat(60)));
        console.log(chalk_1.default.cyan.bold('📧 退信解析详情'));
        console.log(chalk_1.default.cyan('='.repeat(60)) + '\n');
        console.log(chalk_1.default.yellow('收件人:'), chalk_1.default.white(record.recipient));
        console.log(chalk_1.default.yellow('SMTP 状态码:'), chalk_1.default.white(record.smtpCode || '-'));
        console.log(chalk_1.default.yellow('增强状态码:'), chalk_1.default.white(record.enhancedCode || '-'));
        console.log(chalk_1.default.yellow('供应商:'), chalk_1.default.white(record.provider || '-'));
        console.log(chalk_1.default.yellow('批次号:'), chalk_1.default.white(record.batchId || '-'));
        console.log('');
        console.log(chalk_1.default.yellow('退信分类:'), chalk_1.default.bold(record.category));
        console.log(chalk_1.default.yellow('置信度:'), chalk_1.default.white(`${(record.confidence * 100).toFixed(0)}%`));
        console.log(chalk_1.default.yellow('原因描述:'), chalk_1.default.white(record.reason));
        console.log('');
        console.log(chalk_1.default.yellow('重试建议:'));
        console.log(`  可重试: ${record.retrySuggestion.shouldRetry ? chalk_1.default.green('是') : chalk_1.default.red('否')}`);
        if (record.retrySuggestion.retryAfterHours) {
            console.log(`  建议等待: ${record.retrySuggestion.retryAfterHours} 小时`);
        }
        console.log(`  最大重试次数: ${record.retrySuggestion.maxRetries}`);
        console.log(`  说明: ${record.retrySuggestion.reason}`);
        console.log(chalk_1.default.cyan('\n' + '='.repeat(60)) + '\n');
        return 0;
    }
    catch (e) {
        console.error(chalk_1.default.red(`❌ 解析失败: ${e.message}`));
        return 1;
    }
}
//# sourceMappingURL=cli.js.map