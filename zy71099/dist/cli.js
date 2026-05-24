#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const index_1 = require("./index");
const types_1 = require("./types");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
program
    .name('cassette-diff')
    .description('API Cassette 重放差异 CLI 工具 - 对比 HTTP cassette 文件差异')
    .version('1.0.0');
program
    .argument('<expected>', '期望的 cassette 文件路径')
    .argument('<actual>', '实际的 cassette 文件路径')
    .option('-o, --output <dir>', '输出目录，默认为当前目录')
    .option('-c, --config <file>', '配置文件路径 (YAML/JSON)')
    .option('--ignore-order', '忽略请求顺序，按内容匹配')
    .option('--no-ignore-order', '严格按顺序匹配请求')
    .option('--ignore-fields <fields...>', '忽略指定的字段路径，支持通配符')
    .option('-f, --format <format>', '输出格式: text|json|markdown|all', 'text')
    .option('-v, --verbose', '显示详细差异信息')
    .option('-q, --quiet', '静默模式，只输出错误和退出码')
    .action(async (expected, actual, options) => {
    try {
        const { exitCode } = await (0, index_1.compareCassettes)({
            expectedFile: expected,
            actualFile: actual,
            outputDir: options.output,
            configFile: options.config,
            ignoreOrder: options.ignoreOrder,
            ignoreFields: options.ignoreFields,
            format: options.format,
            verbose: options.verbose,
            quiet: options.quiet
        });
        process.exit(exitCode);
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ 错误:'));
        console.error(`  ${error.message}`);
        if (error.line) {
            console.error(chalk_1.default.gray(`  行号: ${error.line}`));
        }
        const explanation = types_1.ExitCodeExplanations.find(e => e.code === error.code);
        if (explanation) {
            console.error(`\n  ${chalk_1.default.bold('退出码:')} ${explanation.code} (${explanation.name})`);
            console.error(`  ${chalk_1.default.bold('说明:')} ${explanation.description}`);
            console.error(`  ${chalk_1.default.bold('建议:')} ${explanation.action}`);
        }
        process.exit(error.code || types_1.ExitCodes.INTERNAL_ERROR);
    }
});
program
    .command('list-codes')
    .description('列出所有退出码及其含义')
    .action(() => {
    console.log(chalk_1.default.bold.cyan('\n  退出码列表\n'));
    for (const explanation of types_1.ExitCodeExplanations) {
        console.log(`  ${chalk_1.default.bold(String(explanation.code).padStart(2))} ${chalk_1.default.gray('─')} ${chalk_1.default.bold(explanation.name)}`);
        console.log(`     ${explanation.description}`);
        console.log(`     ${chalk_1.default.italic('建议: ' + explanation.action)}`);
        console.log('');
    }
});
program
    .command('init-config')
    .description('生成默认配置文件')
    .option('-o, --output <file>', '输出文件路径', 'cassette-diff.config.yaml')
    .action((options) => {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const { getDefaultConfig } = require('./masking/masking-engine');
    const config = getDefaultConfig();
    const content = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(options.output, content, 'utf-8');
    console.log(chalk_1.default.green(`✅ 配置文件已生成: ${options.output}`));
});
program.addHelpText('after', `

${chalk_1.default.bold('示例:')}
  ${chalk_1.default.gray('# 基本用法')}
  cassette-diff expected.yml actual.yml

  ${chalk_1.default.gray('# 忽略请求顺序并生成所有报告')}
  cassette-diff old.yml new.yml --ignore-order -f all -o ./reports

  ${chalk_1.default.gray('# 使用自定义配置并忽略特定字段')}
  cassette-diff v1.yml v2.yml -c config.yml --ignore-fields body.timestamp body.random

  ${chalk_1.default.gray('# 生成默认配置文件')}
  cassette-diff init-config

  ${chalk_1.default.gray('# 查看退出码说明')}
  cassette-diff list-codes
`);
program.parseAsync(process.argv).catch((error) => {
    console.error(chalk_1.default.red('致命错误:'), error);
    process.exit(types_1.ExitCodes.INTERNAL_ERROR);
});
//# sourceMappingURL=cli.js.map