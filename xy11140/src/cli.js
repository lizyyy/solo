#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { validateLensData } = require('./validator');
const { loadRules, sortResults, writeOutput } = require('./utils');

const program = new Command();

program
  .name('lens-validate')
  .description('眼镜店镜片参数校验CLI工具')
  .version('1.0.0')
  .requiredOption('-i, --input <dir>', '输入目录路径')
  .requiredOption('-o, --output <dir>', '输出目录路径')
  .requiredOption('-r, --rules <file>', '规则文件路径')
  .option('-v, --verbose', '显示详细信息')
  .parse(process.argv);

const options = program.opts();

async function main() {
  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const rulesFile = path.resolve(options.rules);

  if (!fs.existsSync(inputDir)) {
    console.error(`错误: 输入目录不存在: ${inputDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(rulesFile)) {
    console.error(`错误: 规则文件不存在: ${rulesFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rules = loadRules(rulesFile);
  const results = await validateLensData(inputDir, rules, options.verbose);
  const sortedResults = sortResults(results);
  
  writeOutput(outputDir, sortedResults, options.verbose);

  const hasWarnings = results.some(r => 
    r.warnings && r.warnings.some(w => 
      w.type === 'EYE_SWAP' || w.type === 'AXIS_RANGE' || w.type === 'REPROCESSED'
    )
  );

  const hasErrors = results.some(r => r.errors && r.errors.length > 0);

  if (hasErrors) {
    console.log('\n校验完成: 存在错误');
    process.exit(2);
  } else if (hasWarnings) {
    console.log('\n校验完成: 部分成功（存在警告）');
    process.exit(3);
  } else {
    console.log('\n校验完成: 全部通过');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
