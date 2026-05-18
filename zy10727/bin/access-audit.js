#!/usr/bin/env node

const { Command } = require('commander');
const { runAudit, formatOutput } = require('../src/index');

const program = new Command();

program
  .name('access-audit')
  .description('门禁离线日志补开记录稽核 CLI 工具')
  .version('1.0.0');

program
  .command('audit')
  .description('执行门禁日志稽核')
  .requiredOption('-n, --normal <path>', '正常通行日志文件路径 (CSV)')
  .requiredOption('-o, --offline <path>', '离线补开日志文件路径 (CSV)')
  .option('-f, --format <type>', '输出格式: json, csv, pretty (默认: pretty)', 'pretty')
  .option('-O, --output <path>', '输出文件路径，不指定则输出到控制台')
  .action(async (options) => {
    try {
      const result = await runAudit({
        normalLogPath: options.normal,
        offlineLogPath: options.offline
      });
      
      const output = formatOutput(result, options.format);
      
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, output, 'utf8');
        console.log(`稽核结果已保存到: ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error('稽核失败:', error.message);
      process.exit(1);
    }
  });

program.parse();
