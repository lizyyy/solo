#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const VideoRenamer = require('./renamer');
const OutputWriter = require('./output');
const CONFIG = require('./config');

const program = new Command();

program
  .name('gym-rename')
  .description('少儿体能馆课程录播重命名 CLI 工具')
  .version('1.0.0')
  .option('-i, --input <dir>', '输入目录路径', './input')
  .option('-o, --output <dir>', '输出目录路径', './output')
  .option('-r, --recursive', '递归处理子目录', false)
  .option('--dry-run', '仅预览不执行重命名', false)
  .option('--no-summary', '不显示处理摘要', false)
  .action(async (options) => {
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('      少儿体能馆课程录播重命名工具'));
    console.log(chalk.cyan('='.repeat(60)));
    console.log();

    const inputDir = path.resolve(options.input);
    const outputDir = path.resolve(options.output);

    if (!fs.existsSync(inputDir)) {
      console.error(chalk.red(`错误: 输入目录不存在: ${inputDir}`));
      process.exit(1);
    }

    console.log(chalk.blue(`输入目录: ${inputDir}`));
    console.log(chalk.blue(`输出目录: ${outputDir}`));
    console.log();

    const renamer = new VideoRenamer();
    const files = scanDirectory(inputDir, options.recursive);

    console.log(chalk.yellow(`找到 ${files.length} 个文件待处理...`));
    console.log();

    files.forEach(file => {
      renamer.processFile(file);
    });

    const results = renamer.getResults();
    const writer = new OutputWriter(outputDir);
    const outputFiles = writer.writeAll(results);

    printResults(results, outputFiles, options);

    if (!options.dryRun && results.normal.length > 0) {
      console.log();
      console.log(chalk.magenta('是否执行实际文件重命名? (y/N)'));
      
      process.stdin.once('data', (data) => {
        const answer = data.toString().trim().toLowerCase();
        if (answer === 'y' || answer === 'yes') {
          performRename(results.normal, inputDir, outputDir);
        } else {
          console.log(chalk.gray('已跳过实际重命名操作'));
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

function scanDirectory(dir, recursive, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      scanDirectory(fullPath, recursive, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  });
  
  return files;
}

function printResults(results, outputFiles, options) {
  console.log(chalk.green('✓ 处理完成!'));
  console.log();

  if (results.normal.length > 0) {
    console.log(chalk.green(`正常处理: ${results.normal.length} 个文件`));
    console.log(chalk.gray(`  详情: ${outputFiles.normal}`));
  }

  if (results.typoFixed.length > 0) {
    console.log(chalk.yellow(`错别字修正: ${results.typoFixed.length} 处`));
    console.log(chalk.gray(`  详情: ${outputFiles.typoFixed}`));
  }

  if (results.multiPart.length > 0) {
    console.log(chalk.magenta(`多段视频: ${results.multiPart.length} 课次`));
    console.log(chalk.gray(`  详情: ${outputFiles.multiPart}`));
  }

  if (results.abnormal.length > 0) {
    console.log(chalk.red(`异常文件: ${results.abnormal.length} 个`));
    console.log(chalk.gray(`  详情: ${outputFiles.abnormal}`));
  }

  console.log();
  console.log(chalk.gray(`处理摘要: ${outputFiles.summary}`));
  console.log();

  if (options.dryRun) {
    console.log(chalk.bgYellow.black(' [预览模式] 未执行实际重命名 '));
    console.log();
  }

  if (!options.noSummary && results.normal.length > 0) {
    console.log(chalk.cyan('--- 预览 (前5项) ---'));
    results.normal.slice(0, 5).forEach(item => {
      console.log(`  ${chalk.gray(item.original)}`);
      console.log(`  → ${chalk.green(item.newName)}`);
      if (item.status === '已修正错别字') {
        console.log(`    ${chalk.yellow('⚠ 已自动修正错别字')}`);
      }
      console.log();
    });
  }
}

function performRename(normalResults, inputDir, outputDir) {
  let successCount = 0;
  let errorCount = 0;

  console.log();
  console.log(chalk.yellow('正在执行重命名...'));

  normalResults.forEach(item => {
    try {
      const oldPath = item.path;
      const newPath = path.join(outputDir, item.newName);
      
      if (oldPath !== newPath) {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.copyFileSync(oldPath, newPath);
        successCount++;
      }
    } catch (e) {
      console.error(chalk.red(`重命名失败: ${item.original} - ${e.message}`));
      errorCount++;
    }
  });

  console.log();
  console.log(chalk.green(`✓ 成功复制/重命名: ${successCount} 个文件`));
  if (errorCount > 0) {
    console.log(chalk.red(`✗ 失败: ${errorCount} 个文件`));
  }
  console.log(chalk.gray(`文件已输出到: ${outputDir}`));
}

program.parse();
