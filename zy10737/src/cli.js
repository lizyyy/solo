#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const { PreauditEngine, RULES, RULE_DESCRIPTIONS } = require('./preaudit-engine');

const program = new Command();

program
  .name('invoice-preaudit')
  .description('发票红冲材料红票申请预审 CLI 工具')
  .version('1.0.0');

program
  .command('run')
  .description('运行发票预审')
  .requiredOption('-i, --input <file>', '输入发票数据文件路径 (JSON格式)')
  .option('-o, --output <directory>', '输出目录路径', './output')
  .option('--rules <rules...>', '指定要启用的预审规则', Object.values(RULES))
  .option('--partial-refund-threshold <number>', '部分退款阈值比例', '0.8')
  .option('--validity-days <number>', '红冲有效期天数', '360')
  .option('--format <format>', '输出格式: json|human', 'json')
  .action((options) => {
    runPreaudit(options);
  });

program
  .command('list-rules')
  .description('列出所有可用的预审规则')
  .action(() => {
    console.log(chalk.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.cyan('        发票红冲材料红票申请预审 - 规则列表          '));
    console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));
    
    Object.entries(RULE_DESCRIPTIONS).forEach(([code, description], index) => {
      console.log(chalk.yellow(`${index + 1}. 规则代码: ${code}`));
      console.log(`   规则描述: ${description}\n`);
    });
  });

program
  .command('sample')
  .description('生成样例发票数据文件')
  .option('-o, --output <file>', '输出文件路径', './sample-invoices.json')
  .action((options) => {
    const sampleData = generateSampleData();
    fs.writeFileSync(options.output, JSON.stringify(sampleData, null, 2));
    console.log(chalk.green(`✓ 样例数据已生成: ${options.output}`));
  });

program
  .action(() => {
    console.log(chalk.yellow('请指定要执行的命令。使用 --help 查看可用命令。'));
    program.help();
  });

function runPreaudit(options) {
  try {
    const inputPath = path.resolve(options.input);
    const outputDir = path.resolve(options.output);

    if (!fs.existsSync(inputPath)) {
      console.error(chalk.red(`✗ 输入文件不存在: ${inputPath}`));
      process.exit(1);
    }

    const rawData = fs.readFileSync(inputPath, 'utf8');
    const invoices = JSON.parse(rawData);

    const engine = new PreauditEngine({
      rules: options.rules,
      partialRefundThreshold: parseFloat(options.partialRefundThreshold),
      redFlushValidityDays: parseInt(options.validityDays)
    });

    const results = engine.audit(invoices);
    const { files } = engine.generateOutputFiles(results, outputDir);

    if (options.format === 'human') {
      console.log(chalk.cyan('═══════════════════════════════════════════════════'));
      console.log(chalk.cyan('        发票红冲材料红票申请预审 CLI 工具             '));
      console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));
      console.log(chalk.blue(`📂 输入文件: ${inputPath}`));
      console.log(chalk.blue(`📂 输出目录: ${outputDir}\n`));
      console.log(chalk.magenta(`📊 共读取 ${invoices.length} 张发票数据\n`));
      printHumanReadableResults(results, files);
      console.log(chalk.green(`\n✓ 预审完成，共生成 ${files.length} 个文件`));
      console.log(chalk.gray(`  输出目录: ${outputDir}`));
    } else {
      printJsonResults(results);
    }

  } catch (error) {
    console.error(chalk.red(`✗ 预审过程出错: ${error.message}`));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

function printHumanReadableResults(results, files) {
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('                    预审结果汇总                    '));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.bold(`📋 总发票数: ${results.summary.total}`));
  console.log(chalk.green(`✅ 可红冲: ${results.summary.approved} 张`));
  console.log(chalk.red(`❌ 驳回: ${results.summary.rejected} 张`));
  console.log(chalk.blue(`📈 通过率: ${((results.summary.approved / results.summary.total) * 100).toFixed(2)}%\n`));

  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('                    规则违规统计                    '));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  Object.entries(results.ruleBreakdown).forEach(([rule, data]) => {
    if (data.count > 0) {
      console.log(chalk.yellow(`⚠️  规则: ${rule}`));
      console.log(`   描述: ${data.description}`);
      console.log(`   违规数: ${data.count} 张\n`);
    }
  });

  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('                    生成文件清单                    '));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  files.forEach((file, index) => {
    console.log(chalk.blue(`${index + 1}. 📄 ${file.fileName}`));
    console.log(`   ${chalk.gray(file.description)}`);
    console.log(`   ${chalk.gray(`路径: ${file.path}`)}\n`);
  });
}

function printJsonResults(results) {
  const output = {
    toolName: '发票红冲材料红票申请预审 CLI',
    version: '1.0.0',
    auditDate: results.summary.auditDate,
    summary: {
      totalInvoices: results.summary.total,
      approvedCount: results.summary.approved,
      rejectedCount: results.summary.rejected,
      approvalRate: `${((results.summary.approved / results.summary.total) * 100).toFixed(2)}%`
    },
    ruleBreakdown: Object.fromEntries(
      Object.entries(results.ruleBreakdown).map(([rule, data]) => [
        rule,
        {
          description: data.description,
          violationCount: data.count
        }
      ])
    )
  };
  console.log(JSON.stringify(output, null, 2));
}

function generateSampleData() {
  return [
    {
      invoiceNumber: '44032311301234567890',
      invoiceDate: '2026-01-15',
      originalInvoiceNumber: '44032311301111111111',
      buyerName: '深圳XX科技有限公司',
      sellerName: '广州YY贸易有限公司',
      amount: 10000.00,
      taxAmount: 1300.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    },
    {
      invoiceNumber: '31002311309876543210',
      invoiceDate: '2026-02-20',
      originalInvoiceNumber: '31002311302222222222',
      buyerName: '上海ZZ实业有限公司',
      sellerName: '北京WW商贸有限公司',
      amount: 8500.00,
      taxAmount: 510.00,
      taxRate: 0.06,
      originalTaxRate: 0.06,
      redFlushType: 'partial',
      refundType: 'partial',
      originalInvoiceAmount: 10000.00,
      remainingAmount: 10000.00,
      attachments: ['red_flush_agreement', 'proof_of_return', 'partial_refund_agreement']
    },
    {
      invoiceNumber: '33002311305555555555',
      invoiceDate: '2025-01-01',
      originalInvoiceNumber: '33002311306666666666',
      buyerName: '杭州AA电子有限公司',
      sellerName: '宁波BB制造有限公司',
      amount: 5000.00,
      taxAmount: 650.00,
      taxRate: 0.13,
      originalTaxRate: 0.13,
      redFlushType: 'full',
      refundType: 'full',
      originalInvoiceAmount: 5000.00,
      remainingAmount: 5000.00,
      attachments: ['red_flush_agreement', 'proof_of_return']
    }
  ];
}

program.parse(process.argv);
