#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { analyzeCSV } = require('./core');
const {
  generateTerminalSummary,
  generateMachineReadable,
  generateFriendlyReport,
  saveBadRowsCSV
} = require('./reporter');

const argv = yargs(hideBin(process.argv))
  .usage('使用: $0 <file> [options]')
  .example('$0 data.csv -k id', '检测 id 列的重复')
  .example('$0 users.csv -k username,email', '检测联合主键重复')
  .positional('file', {
    describe: 'CSV 文件路径',
    type: 'string'
  })
  .option('key', {
    alias: 'k',
    describe: '主键列名，多列用逗号分隔',
    type: 'string',
    demandOption: true
  })
  .option('no-trim', {
    describe: '不进行首尾去空格',
    type: 'boolean',
    default: false
  })
  .option('no-collapse-spaces', {
    describe: '不合并连续空格',
    type: 'boolean',
    default: false
  })
  .option('lower-case', {
    describe: '转换为小写（不区分大小写）',
    type: 'boolean',
    default: false
  })
  .option('remove-non-printable', {
    describe: '移除不可打印字符',
    type: 'boolean',
    default: false
  })
  .option('output-json', {
    alias: 'j',
    describe: '输出 JSON 结果的文件路径',
    type: 'string'
  })
  .option('output-report', {
    alias: 'r',
    describe: '输出友好报告的文件路径 (Markdown)',
    type: 'string'
  })
  .option('output-bad-rows', {
    alias: 'b',
    describe: '输出坏行 CSV 的文件路径',
    type: 'string'
  })
  .option('quiet', {
    alias: 'q',
    describe: '不输出终端摘要',
    type: 'boolean',
    default: false
  })
  .help('help')
  .alias('help', 'h')
  .epilog('退出码: 0=无问题, 1=发现问题, 2=执行错误')
  .argv;

async function main() {
  try {
    const filePath = argv._[0] || argv.file;
    
    if (!filePath) {
      console.error('错误: 请指定 CSV 文件路径');
      process.exit(2);
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`错误: 文件不存在: ${filePath}`);
      process.exit(2);
    }
    
    const keyColumns = argv.key.split(',').map(k => k.trim());
    
    const normalizeOptions = {
      trim: !argv['no-trim'],
      collapseSpaces: !argv['no-collapse-spaces'],
      toLowerCase: argv['lower-case'],
      removeNonPrintable: argv['remove-non-printable']
    };
    
    const results = await analyzeCSV(filePath, keyColumns, normalizeOptions);
    
    if (!argv.quiet) {
      console.log(generateTerminalSummary(results));
    }
    
    const baseName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(filePath);
    
    if (argv['output-json']) {
      const jsonPath = argv['output-json'] === true 
        ? path.join(dirName, `${baseName}_result.json`)
        : argv['output-json'];
      fs.writeFileSync(jsonPath, generateMachineReadable(results));
      if (!argv.quiet) {
        console.log(`\nJSON 结果已保存到: ${jsonPath}`);
      }
    }
    
    if (argv['output-report']) {
      const reportPath = argv['output-report'] === true
        ? path.join(dirName, `${baseName}_report.md`)
        : argv['output-report'];
      fs.writeFileSync(reportPath, generateFriendlyReport(results));
      if (!argv.quiet) {
        console.log(`友好报告已保存到: ${reportPath}`);
      }
    }
    
    if (argv['output-bad-rows']) {
      const badRowsPath = argv['output-bad-rows'] === true
        ? path.join(dirName, `${baseName}_bad_rows.csv`)
        : argv['output-bad-rows'];
      saveBadRowsCSV(results, badRowsPath);
      if (!argv.quiet) {
        console.log(`坏行 CSV 已保存到: ${badRowsPath}`);
      }
    }
    
    const hasIssues = results.duplicateCount > 0 || results.nullKeyCount > 0;
    process.exit(hasIssues ? 1 : 0);
    
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(2);
  }
}

main();
