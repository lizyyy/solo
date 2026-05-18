#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { processSurveyData } = require('./processor');

const program = new Command();

program
  .name('survey-quota')
  .description('问卷回收数据配额补样计算 CLI')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '问卷回收数据输入路径 (CSV 文件)')
  .requiredOption('-r, --rules <path>', '配额规则文件路径 (JSON 文件)')
  .requiredOption('-o, --output <dir>', '结果输出目录')
  .option('-d, --dry-run', '试运行，不生成输出文件')
  .option('-f, --force', '覆盖已存在的输出文件')
  .action(async (options) => {
    try {
      const inputPath = path.resolve(options.input);
      const rulesPath = path.resolve(options.rules);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(inputPath)) {
        console.error(`❌ 错误: 输入文件不存在 - ${inputPath}`);
        process.exit(1);
      }

      if (!fs.existsSync(rulesPath)) {
        console.error(`❌ 错误: 规则文件不存在 - ${rulesPath}`);
        process.exit(1);
      }

      if (!options.dryRun && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await processSurveyData({
        inputPath,
        rulesPath,
        outputDir,
        dryRun: options.dryRun,
        force: options.force
      });

    } catch (error) {
      console.error('\n❌ 问卷回收数据配额补样计算执行失败:');
      console.error(`   错误信息: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
