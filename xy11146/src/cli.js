#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const MealCouponAuditor = require('./auditor');

const RULES_PATH = path.join(__dirname, '..', 'config', 'rules.json');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'output');

yargs(hideBin(process.argv))
  .command(
    'audit <input>',
    '稽核助餐券核销数据',
    (yargs) => {
      return yargs
        .positional('input', {
          describe: 'CSV文件路径或目录路径',
          type: 'string'
        })
        .option('output', {
          alias: 'o',
          describe: '报告输出目录',
          type: 'string',
          default: DEFAULT_OUTPUT_DIR
        })
        .option('rules', {
          alias: 'r',
          describe: '规则配置文件路径',
          type: 'string',
          default: RULES_PATH
        });
    },
    async (argv) => {
      try {
        const inputPath = path.resolve(argv.input);
        
        if (!fs.existsSync(inputPath)) {
          console.error(`错误: 路径不存在 - ${inputPath}`);
          process.exit(1);
        }

        const rulesPath = path.resolve(argv.rules);
        if (!fs.existsSync(rulesPath)) {
          console.error(`错误: 规则配置文件不存在 - ${rulesPath}`);
          process.exit(1);
        }

        console.log('=======================================');
        console.log('  公益助餐点助餐券核销稽核工具');
        console.log('=======================================');
        console.log(`输入路径: ${inputPath}`);
        console.log(`规则配置: ${rulesPath}`);
        console.log('');

        const auditor = new MealCouponAuditor(rulesPath);
        const results = await auditor.auditPath(inputPath);

        console.log(auditor.formatSummaryText(results));

        const outputDir = path.resolve(argv.output);
        const { reportPath, summaryPath } = auditor.generateReport(results, outputDir);
        
        console.log(`详细报告已保存至: ${reportPath}`);
        console.log(`摘要报告已保存至: ${summaryPath}`);
        console.log('');

        const hasErrors = results.summary.formatErrors > 0 ||
                         results.summary.crossDayUploads > 0 ||
                         results.summary.levelChanges > 0 ||
                         results.summary.duplicateRuns > 0;
        
        process.exit(hasErrors ? 1 : 0);
      } catch (error) {
        console.error('稽核过程出错:', error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'show-rules',
    '显示当前稽核规则配置',
    (yargs) => {
      return yargs.option('rules', {
        alias: 'r',
        describe: '规则配置文件路径',
        type: 'string',
        default: RULES_PATH
      });
    },
    (argv) => {
      const rulesPath = path.resolve(argv.rules);
      if (!fs.existsSync(rulesPath)) {
        console.error(`错误: 规则配置文件不存在 - ${rulesPath}`);
        process.exit(1);
      }

      const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      console.log(JSON.stringify(rules, null, 2));
    }
  )
  .example('$0 audit data/sample.csv', '稽核单个CSV文件')
  .example('$0 audit data/', '稽核目录下所有CSV文件')
  .example('$0 audit data/sample.csv -o reports/', '指定输出目录')
  .example('$0 show-rules', '显示规则配置')
  .demandCommand(1, '请指定要执行的命令')
  .help()
  .alias('help', 'h')
  .version('1.0.0')
  .alias('version', 'v')
  .epilog('公益助餐点助餐券核销稽核工具 - 让数据更透明')
  .argv;
