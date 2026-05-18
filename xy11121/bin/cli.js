#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const SigninCleaner = require('../src/index');

const program = new Command();

program
  .name('library-signin-cleaner')
  .description('图书馆活动组活动签到数据清洗CLI工具')
  .version('1.0.0')
  .option('-i, --input <dir>', '输入目录路径', './input')
  .option('-r, --rules <file>', '规则文件路径', './rules.json')
  .option('-o, --output <dir>', '输出目录路径', './output')
  .option('-p, --preview', '预览模式，不生成实际文件')
  .parse(process.argv);

const options = program.opts();

const inputDir = path.resolve(options.input);
const rulesFile = path.resolve(options.rules);
const outputDir = path.resolve(options.output);

if (!fs.existsSync(inputDir)) {
  console.error(`错误：输入目录不存在: ${inputDir}`);
  process.exit(1);
}

if (!fs.existsSync(rulesFile)) {
  console.error(`错误：规则文件不存在: ${rulesFile}`);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const cleaner = new SigninCleaner({
  inputDir,
  rulesFile,
  outputDir,
  preview: options.preview
});

cleaner.run()
  .then(() => {
    console.log('\n处理完成！');
    if (options.preview) {
      console.log('预览模式 - 未生成实际输出文件');
    } else {
      console.log(`输出目录: ${outputDir}`);
      console.log(`查看报告: npm run report`);
    }
  })
  .catch((err) => {
    console.error('处理失败:', err.message);
    process.exit(1);
  });
