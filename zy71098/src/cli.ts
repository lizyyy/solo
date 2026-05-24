import { Command } from 'commander';
import * as Joi from 'joi';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { BounceParser } from './core/bounce-parser';
import { ReportGenerator } from './core/report-generator';
import { OutputHandler } from './core/output-handler';
import { SelfCheck } from './core/self-check';
import { defaultConfig } from './config/default';
import { BounceRecord, CliOptions } from './types';

const program = new Command();

const optionsSchema = Joi.object({
  input: Joi.string(),
  inputDir: Joi.string(),
  recipient: Joi.string(),
  smtpCode: Joi.string(),
  provider: Joi.string(),
  batchId: Joi.string(),
  outputDir: Joi.string().default(defaultConfig.output.defaultDir),
  format: Joi.array().items(Joi.string().valid('json', 'markdown', 'summary', 'all')).default(['summary']),
  config: Joi.string(),
  verbose: Joi.boolean().default(false)
}).xor('input', 'inputDir', 'recipient');

export async function runCli(): Promise<number> {
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
    .option('-o, --output-dir <dir>', '输出目录', defaultConfig.output.defaultDir)
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

async function handleAnalyzeCommand(options: any): Promise<number> {
  try {
    const { error, value } = optionsSchema.validate(options);
    if (error) {
      console.error(chalk.red(`❌ 参数错误: ${error.message}`));
      return 1;
    }

    const opts = value as CliOptions;
    const parser = new BounceParser();
    const reportGenerator = new ReportGenerator();
    const outputHandler = new OutputHandler(opts.outputDir);

    let records: BounceRecord[] = [];

    if (opts.input) {
      if (!fs.existsSync(opts.input)) {
        console.error(chalk.red(`❌ 输入文件不存在: ${opts.input}`));
        return 1;
      }
      const record = await parser.parseEmailFile(opts.input);
      records.push(record);
    }

    if (opts.inputDir) {
      if (!fs.existsSync(opts.inputDir)) {
        console.error(chalk.red(`❌ 输入目录不存在: ${opts.inputDir}`));
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
      console.error(chalk.yellow('⚠️  没有解析到任何退信记录'));
      return 0;
    }

    if (opts.verbose) {
      console.log(chalk.gray(`📝 解析到 ${records.length} 条退信记录`));
    }

    const report = reportGenerator.generateReport(records);

    const formats = opts.format.includes('all') 
      ? ['json', 'markdown', 'summary'] 
      : opts.format;

    const outputFiles: string[] = [];

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
      console.log(chalk.green('\n✅ 输出文件已生成:'));
      for (const file of outputFiles) {
        console.log(chalk.gray(`   - ${path.resolve(file)}`));
      }
    }

    return 0;
  } catch (e) {
    console.error(chalk.red(`❌ 执行失败: ${(e as Error).message}`));
    console.error(chalk.gray((e as Error).stack || ''));
    return 1;
  }
}

async function handleSelfCheckCommand(options: { outputDir: string }): Promise<number> {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('🧪 邮件退信分析器 - 自检模式'));
  console.log(chalk.cyan('='.repeat(60)) + '\n');

  const selfCheck = new SelfCheck(options.outputDir);
  const results = await selfCheck.runAllTests();

  let passed = 0;
  let failed = 0;

  console.log(chalk.yellow.bold('📋 测试结果:'));
  console.log(chalk.gray('-'.repeat(60)));

  for (const result of results) {
    const status = result.passed 
      ? chalk.green('✓ PASS') 
      : chalk.red('✗ FAIL');
    
    if (result.passed) passed++;
    else failed++;

    console.log(`  ${status} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(chalk.gray(`     ${result.error}`));
    }
  }

  console.log(chalk.gray('-'.repeat(60)));
  console.log(`\n  总计: ${chalk.white.bold(results.length)} 测试`);
  console.log(`  通过: ${chalk.green.bold(passed)}`);
  console.log(`  失败: ${chalk.red.bold(failed)}\n`);

  if (failed > 0) {
    console.log(chalk.red('❌ 自检失败，请检查上述错误信息'));
    return 1;
  } else {
    console.log(chalk.green('✅ 所有测试通过！解析器工作正常。'));
    console.log(chalk.gray(`   测试报告已输出到: ${options.outputDir}`));
    return 0;
  }
}

async function handleParseCommand(file: string): Promise<number> {
  try {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`❌ 文件不存在: ${file}`));
      return 1;
    }

    const parser = new BounceParser();
    const record = await parser.parseEmailFile(file);

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan.bold('📧 退信解析详情'));
    console.log(chalk.cyan('='.repeat(60)) + '\n');

    console.log(chalk.yellow('收件人:'), chalk.white(record.recipient));
    console.log(chalk.yellow('SMTP 状态码:'), chalk.white(record.smtpCode || '-'));
    console.log(chalk.yellow('增强状态码:'), chalk.white(record.enhancedCode || '-'));
    console.log(chalk.yellow('供应商:'), chalk.white(record.provider || '-'));
    console.log(chalk.yellow('批次号:'), chalk.white(record.batchId || '-'));
    console.log('');
    
    console.log(chalk.yellow('退信分类:'), chalk.bold(record.category));
    console.log(chalk.yellow('置信度:'), chalk.white(`${(record.confidence * 100).toFixed(0)}%`));
    console.log(chalk.yellow('原因描述:'), chalk.white(record.reason));
    console.log('');
    
    console.log(chalk.yellow('重试建议:'));
    console.log(`  可重试: ${record.retrySuggestion.shouldRetry ? chalk.green('是') : chalk.red('否')}`);
    if (record.retrySuggestion.retryAfterHours) {
      console.log(`  建议等待: ${record.retrySuggestion.retryAfterHours} 小时`);
    }
    console.log(`  最大重试次数: ${record.retrySuggestion.maxRetries}`);
    console.log(`  说明: ${record.retrySuggestion.reason}`);

    console.log(chalk.cyan('\n' + '='.repeat(60)) + '\n');

    return 0;
  } catch (e) {
    console.error(chalk.red(`❌ 解析失败: ${(e as Error).message}`));
    return 1;
  }
}
