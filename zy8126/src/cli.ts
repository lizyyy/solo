#!/usr/bin/env node

import { program } from 'commander';
import * as path from 'path';
import { Parser } from './parser';
import { LayoutEngine } from './layout-engine';
import { Validator } from './validator';
import { Exporter } from './exporter';
import { Template, Transaction, PrinterProfile, RenderedReceipt, ValidationResult } from './types';

interface CliOptions {
  dataDir: string;
  outputDir: string;
  template?: string;
  transaction?: string;
  printer?: string;
  verbose: boolean;
}

async function loadData(options: CliOptions) {
  const parser = new Parser(options.dataDir);

  const fileCheck = await parser.verifyRequiredFiles();
  if (!fileCheck.valid) {
    console.error('错误: 缺少必要的文件:');
    for (const missing of fileCheck.missing) {
      console.error(`  - ${missing}`);
    }
    process.exit(1);
  }

  const printerProfiles = await parser.loadPrinterProfiles();
  const templates = await parser.loadAllTemplates();
  const transactions = await parser.loadTransactions();

  if (templates.size === 0) {
    console.error('错误: templates 目录中没有找到模板文件');
    process.exit(1);
  }

  if (transactions.length === 0) {
    console.error('错误: transactions.jsonl 中没有找到交易数据');
    process.exit(1);
  }

  return { parser, printerProfiles, templates, transactions };
}

function selectPrinterProfile(
  printerProfiles: Record<string, PrinterProfile>,
  template: Template,
  optionsPrinter?: string
): PrinterProfile {
  let profileName = optionsPrinter || template.printerProfile;
  
  if (!profileName) {
    const profileNames = Object.keys(printerProfiles);
    if (profileNames.length > 0) {
      profileName = profileNames[0];
      console.warn(`警告: 模板未指定打印机配置，使用默认配置: ${profileName}`);
    } else {
      console.error('错误: 没有可用的打印机配置');
      process.exit(1);
    }
  }

  const profile = printerProfiles[profileName];
  if (!profile) {
    console.error(`错误: 打印机配置 "${profileName}" 不存在`);
    console.error('可用的配置:');
    for (const name of Object.keys(printerProfiles)) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  return profile;
}

async function renderAction(options: CliOptions) {
  const { printerProfiles, templates, transactions } = await loadData(options);

  const selectedTemplates: Map<string, Template> = new Map();
  if (options.template) {
    const template = templates.get(options.template);
    if (!template) {
      console.error(`错误: 模板 "${options.template}" 不存在`);
      console.error('可用的模板:');
      for (const name of templates.keys()) {
        console.error(`  - ${name}`);
      }
      process.exit(1);
    }
    selectedTemplates.set(options.template, template);
  } else {
    for (const [name, template] of templates.entries()) {
      selectedTemplates.set(name, template);
    }
  }

  let selectedTransactions: Transaction[];
  if (options.transaction) {
    const tx = transactions.find(t => t.id === options.transaction);
    if (!tx) {
      console.error(`错误: 交易 "${options.transaction}" 不存在`);
      process.exit(1);
    }
    selectedTransactions = [tx];
  } else {
    selectedTransactions = transactions;
  }

  const allReceipts: RenderedReceipt[] = [];
  const allResults: ValidationResult[] = [];

  for (const [templateName, template] of selectedTemplates.entries()) {
    const printerProfile = selectPrinterProfile(printerProfiles, template, options.printer);
    const layoutEngine = new LayoutEngine(printerProfile);
    const validator = new Validator(printerProfile);

    for (const transaction of selectedTransactions) {
      const renderedReceipt = layoutEngine.render(template, transaction);
      const validationResult = validator.validate(template, transaction, renderedReceipt);

      allReceipts.push(renderedReceipt);
      allResults.push(validationResult);

      if (options.verbose) {
        console.log(`\n=== 模板: ${templateName} | 交易: ${transaction.id} ===`);
        console.log(`纸宽: ${printerProfile.paperWidth}mm, 每行字符: ${printerProfile.charsPerLine}`);
        console.log(`总行数: ${renderedReceipt.totalLines}`);
        console.log(`问题数: ${validationResult.statistics.total} (错误: ${validationResult.statistics.errors}, 警告: ${validationResult.statistics.warnings})`);
        
        for (const line of renderedReceipt.lines) {
          console.log(line.text);
        }
      }
    }
  }

  const exporter = new Exporter(options.outputDir);
  const exportResult = await exporter.exportAll(allReceipts, allResults);

  console.log('\n' + '='.repeat(60));
  console.log('                    渲染完成');
  console.log('='.repeat(60));
  console.log(`\n处理票据数: ${exportResult.summary.totalReceipts}`);
  console.log(`问题总数: ${exportResult.summary.totalIssues}`);
  console.log(`  - 错误: ${exportResult.summary.errors}`);
  console.log(`  - 警告: ${exportResult.summary.warnings}`);
  console.log(`\n输出文件:`);
  console.log(`  - 预览: ${exportResult.previewFile}`);
  console.log(`  - 问题: ${exportResult.issuesFile}`);
  console.log(`  - 报告: ${exportResult.reportFile}`);

  if (exportResult.summary.errors > 0) {
    process.exit(1);
  }
}

async function validateAction(options: CliOptions) {
  const { printerProfiles, templates, transactions } = await loadData(options);

  const selectedTemplates: Map<string, Template> = new Map();
  if (options.template) {
    const template = templates.get(options.template);
    if (!template) {
      console.error(`错误: 模板 "${options.template}" 不存在`);
      process.exit(1);
    }
    selectedTemplates.set(options.template, template);
  } else {
    for (const [name, template] of templates.entries()) {
      selectedTemplates.set(name, template);
    }
  }

  let selectedTransactions: Transaction[];
  if (options.transaction) {
    const tx = transactions.find(t => t.id === options.transaction);
    if (!tx) {
      console.error(`错误: 交易 "${options.transaction}" 不存在`);
      process.exit(1);
    }
    selectedTransactions = [tx];
  } else {
    selectedTransactions = transactions;
  }

  const allResults: ValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log('\n' + '='.repeat(60));
  console.log('                    验证结果');
  console.log('='.repeat(60));

  for (const [templateName, template] of selectedTemplates.entries()) {
    const printerProfile = selectPrinterProfile(printerProfiles, template, options.printer);
    const layoutEngine = new LayoutEngine(printerProfile);
    const validator = new Validator(printerProfile);

    for (const transaction of selectedTransactions) {
      const renderedReceipt = layoutEngine.render(template, transaction);
      const validationResult = validator.validate(template, transaction, renderedReceipt);

      allResults.push(validationResult);
      totalErrors += validationResult.statistics.errors;
      totalWarnings += validationResult.statistics.warnings;

      if (validationResult.statistics.total > 0) {
        console.log(`\n--- 模板: ${templateName} | 交易: ${transaction.id} ---`);
        console.log(`问题数: ${validationResult.statistics.total}`);

        for (const issue of validationResult.issues) {
          const severityIcon = issue.severity === 'error' ? '❌' : 
                              issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`  ${severityIcon} [${issue.type}] ${issue.message}`);
          if (options.verbose) {
            if (issue.field) console.log(`     字段: ${issue.field}`);
            if (issue.expected) console.log(`     期望: ${issue.expected}`);
            if (issue.actual) console.log(`     实际: ${issue.actual}`);
          }
        }
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`验证统计:`);
  console.log(`  - 总问题数: ${totalErrors + totalWarnings}`);
  console.log(`  - 错误数: ${totalErrors}`);
  console.log(`  - 警告数: ${totalWarnings}`);

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n✅ 所有验证通过！');
  } else {
    if (totalErrors > 0) {
      console.log(`\n❌ 发现 ${totalErrors} 个错误，需要修复。`);
      process.exit(1);
    } else {
      console.log(`\n⚠️ 发现 ${totalWarnings} 个警告，建议检查。`);
    }
  }
}

async function main() {
  const defaultDataDir = process.cwd();
  const defaultOutputDir = path.join(process.cwd(), 'output');

  program
    .name('receipt-player')
    .description('票据版式回放器 - 离线检查 POS/自助机小票模板')
    .version('1.0.0')
    .option('-d, --data-dir <path>', '数据目录路径', defaultDataDir)
    .option('-o, --output-dir <path>', '输出目录路径', defaultOutputDir)
    .option('-t, --template <name>', '指定模板名称')
    .option('--transaction <id>', '指定交易ID')
    .option('-p, --printer <profile>', '指定打印机配置')
    .option('-v, --verbose', '显示详细输出');

  program
    .command('render')
    .description('渲染票据并生成预览')
    .action(async () => {
      const options = program.opts<CliOptions>();
      await renderAction(options);
    });

  program
    .command('validate')
    .description('验证票据数据和模板格式')
    .action(async () => {
      const options = program.opts<CliOptions>();
      await validateAction(options);
    });

  program.parse(process.argv);

  if (program.args.length === 0) {
    program.outputHelp();
  }
}

main().catch((error: unknown) => {
  console.error('错误:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
