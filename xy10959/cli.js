#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { OUTPUT_FILES } = require('./config');
const { validateInput } = require('./src/validator');
const { readCSV } = require('./src/csvReader');
const { deduplicateLeads } = require('./src/deduplicator');
const { generateOutputs } = require('./src/outputGenerator');

const program = new Command();

program
  .name('lead-dedup')
  .description('渠道线索去重CLI工具')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '输入CSV文件路径')
  .option('-o, --output <directory>', '输出目录，默认为当前目录', './output')
  .option('-p, --priority <channels>', '来源优先级，逗号分隔，如: 展会,表单,电话', '展会,表单,电话')
  .option('-t, --threshold <number>', '模糊匹配阈值 0-1，默认为0.85', parseFloat, 0.85)
  .option('-k, --keep-all', '保留所有重复记录，只标记组号')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('\n╔════════════════════════════════════════╗'));
    console.log(chalk.blue('║     渠道线索去重CLI工具 v1.0.0        ║'));
    console.log(chalk.blue('╚════════════════════════════════════════╝\n'));

    const validation = validateInput(options);
    if (!validation.valid) {
      console.error(chalk.red('✗ 输入验证失败:'));
      validation.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    console.log(chalk.green('✓ 输入验证通过'));

    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(chalk.yellow(`⚠ 创建输出目录: ${outputDir}`));
    }

    const priorityMap = {};
    options.priority.split(',').forEach((chan, idx) => {
      priorityMap[chan.trim()] = idx + 1;
    });

    console.log(chalk.green(`✓ 来源优先级: ${options.priority}`));

    console.log(chalk.cyan('\n正在读取CSV文件...'));
    const { data, headers, errors } = await readCSV(options.input);
    console.log(chalk.green(`✓ 读取完成: 共 ${data.length} 条记录，${errors.length} 条坏行`));

    console.log(chalk.cyan('\n正在执行去重逻辑...'));
    const results = deduplicateLeads(data, {
      priorityMap,
      threshold: options.threshold,
      keepAll: options.keepAll
    });

    console.log(chalk.green(`✓ 去重完成: 保留 ${results.cleaned.length} 条，发现 ${results.duplicateGroups.length} 组重复`));

    console.log(chalk.cyan('\n正在生成输出文件...'));
    await generateOutputs(results, {
      outputDir,
      headers,
      errors,
      options
    });

    printSummary(results, errors, outputDir);

    console.log(chalk.green('\n✓ 处理完成!\n'));

  } catch (error) {
    console.error(chalk.red('\n✗ 处理失败:'), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

function printSummary(results, errors, outputDir) {
  console.log(chalk.cyan('\n════════════════════ 处理摘要 ════════════════════'));
  console.log(chalk.white(`总记录数:     ${results.total}`));
  console.log(chalk.white(`保留记录数:   ${results.cleaned.length}`));
  console.log(chalk.white(`重复组数:     ${results.duplicateGroups.length}`));
  console.log(chalk.white(`涉及重复数:   ${results.duplicateCount}`));
  console.log(chalk.white(`坏行/异常:    ${errors.length}`));
  console.log(chalk.white(`合并建议数:   ${results.mergeSuggestions.length}`));
  
  console.log(chalk.cyan('\n════════════════════ 输出文件 ════════════════════'));
  Object.values(OUTPUT_FILES).forEach(file => {
    const filePath = path.join(outputDir, file);
    if (fs.existsSync(filePath)) {
      console.log(chalk.green(`  ✓ ${file}`));
    }
  });
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
}

main();
