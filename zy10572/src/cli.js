#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const encodingDetector = require('./encodingDetector');
const charCleaner = require('./charCleaner');
const reportGenerator = require('./reportGenerator');

const program = new Command();

program
  .name('text-fix')
  .description('文本编码修复CLI工具 - 清洗全角符号、不可见字符和乱码')
  .version('1.0.0');

program
  .command('clean')
  .description('清洗单个文本文件')
  .argument('<file>', '要处理的文本文件路径')
  .option('-o, --output <dir>', '输出目录，默认为 ./output')
  .option('--no-fullwidth', '不转换全角字符')
  .option('--no-invisible', '不删除不可见字符')
  .option('--no-mojibake', '不替换乱码字符')
  .option('--preview', '仅预览修复效果，不保存文件')
  .action((file, options) => {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
      process.exit(1);
    }

    const outputDir = path.resolve(options.output || './output');
    if (!options.preview && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    processFile(filePath, outputDir, options);
  });

program
  .command('batch')
  .description('批量清洗目录下的所有文本文件')
  .argument('<dir>', '包含文本文件的目录')
  .option('-o, --output <dir>', '输出目录，默认为 <dir>/cleaned')
  .option('-e, --ext <extensions>', '文件扩展名，逗号分隔，默认为 txt,csv,log', 'txt,csv,log')
  .option('--no-fullwidth', '不转换全角字符')
  .option('--no-invisible', '不删除不可见字符')
  .option('--no-mojibake', '不替换乱码字符')
  .action((dir, options) => {
    const inputDir = path.resolve(dir);
    if (!fs.existsSync(inputDir)) {
      console.error(chalk.red(`错误: 目录不存在 - ${inputDir}`));
      process.exit(1);
    }

    const outputDir = path.resolve(options.output || path.join(inputDir, 'cleaned'));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const extensions = options.ext.split(',').map(e => e.trim().toLowerCase());
    const files = fs.readdirSync(inputDir)
      .filter(f => extensions.includes(path.extname(f).toLowerCase().slice(1)))
      .map(f => path.join(inputDir, f));

    if (files.length === 0) {
      console.log(chalk.yellow('未找到匹配的文本文件'));
      process.exit(0);
    }

    console.log(chalk.blue(`找到 ${files.length} 个文件进行处理\n`));

    const timestamp = getTimestamp();
    const summary = {
      total: files.length,
      success: 0,
      failed: 0,
      files: []
    };

    files.forEach((filePath, index) => {
      try {
        console.log(chalk.gray(`[${index + 1}/${files.length}] 处理: ${path.basename(filePath)}`));
        const result = processFile(filePath, outputDir, { ...options, silent: true, timestamp });
        summary.success++;
        summary.files.push({
          file: path.basename(filePath),
          status: 'success',
          stats: result.cleanResult.stats
        });
      } catch (error) {
        summary.failed++;
        summary.files.push({
          file: path.basename(filePath),
          status: 'failed',
          error: error.message
        });
        console.error(chalk.red(`  处理失败: ${error.message}`));
      }
    });

    console.log('\n' + chalk.bold.green('='.repeat(60)));
    console.log(chalk.bold.green('  批量处理完成!'));
    console.log(chalk.bold.green('='.repeat(60)));
    console.log(`  总数: ${summary.total}`);
    console.log(`  成功: ${chalk.green(summary.success)}`);
    console.log(`  失败: ${chalk.red(summary.failed)}`);
    console.log(`  输出目录: ${outputDir}`);

    const summaryPath = path.join(outputDir, `batch_summary_${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n  汇总报告: ${summaryPath}`);
  });

program
  .command('detect')
  .description('仅检测文件编码和问题，不进行修复')
  .argument('<file>', '要检测的文本文件路径')
  .action((file) => {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
      process.exit(1);
    }

    const encodingInfo = encodingDetector.detectEncoding(filePath);
    const text = encodingDetector.readFileWithEncoding(filePath, encodingInfo.encoding);
    const cleanResult = charCleaner.cleanText(text, {
      fixFullwidth: false,
      removeInvisible: false,
      fixMojibake: false
    });
    const lineAnalysis = reportGenerator.analyzeLines(text, charCleaner);

    reportGenerator.generateTerminalSummary(
      { encodingInfo, cleanResult, lineAnalysis },
      filePath
    );
  });

function processFile(filePath, outputDir, options) {
  const { silent = false, preview = false, timestamp } = options;

  if (!silent) {
    console.log(chalk.blue(`处理文件: ${path.basename(filePath)}`));
  }

  const encodingInfo = encodingDetector.detectEncoding(filePath);
  const text = encodingDetector.readFileWithEncoding(filePath, encodingInfo.encoding);

  const cleanResult = charCleaner.cleanText(text, {
    fixFullwidth: options.fullwidth !== false,
    removeInvisible: options.invisible !== false,
    fixMojibake: options.mojibake !== false
  });

  const lineAnalysis = reportGenerator.analyzeLines(text, charCleaner);

  const result = { encodingInfo, cleanResult, lineAnalysis };

  if (!silent) {
    reportGenerator.generateTerminalSummary(result, filePath);
  }

  if (!preview) {
    const fileTimestamp = timestamp || getTimestamp();
    const paths = reportGenerator.saveReports(result, filePath, outputDir, fileTimestamp);

    if (!silent) {
      console.log(chalk.bold('💾 已保存文件:'));
      console.log(`  清洗后的文本: ${chalk.cyan(paths.cleanedPath)}`);
      console.log(`  JSON 结果: ${chalk.cyan(paths.jsonPath)}`);
      console.log(`  HTML 报告: ${chalk.cyan(paths.htmlPath)}`);
      if (paths.badLinesPath) {
        console.log(`  坏行记录: ${chalk.yellow(paths.badLinesPath)}`);
      }
      console.log('');
    }
  }

  return result;
}

function getTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
}

program.parse();
