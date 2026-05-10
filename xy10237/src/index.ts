#!/usr/bin/env node

import { Command } from 'commander';
import { CLIHandler } from './services/cliHandler';
import chalk from 'chalk';

const program = new Command();
const handler = new CLIHandler();

program
  .name('customs-checker')
  .description('跨境样品清关材料检查 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化样例数据和配置')
  .option('-f, --force', '强制重新初始化')
  .action((options) => {
    handler.init(options.force);
  });

program
  .command('list')
  .alias('ls')
  .description('列出所有样品')
  .action(() => {
    handler.list();
  });

program
  .command('import <file>')
  .description('从JSON文件导入样品数据')
  .action((file) => {
    handler.import(file);
  });

program
  .command('check <sample-id>')
  .description('执行清关材料检查')
  .option('--no-details', '不显示详细信息')
  .action((sampleId, options) => {
    handler.check(sampleId, options.details);
  });

program
  .command('history <sample-id>')
  .alias('log')
  .description('查看样品的检查历史')
  .option('-l, --limit <number>', '显示最近N条记录', '10')
  .action((sampleId, options) => {
    handler.history(sampleId, parseInt(options.limit));
  });

program
  .command('export <sample-id>')
  .description('导出检查结果')
  .option('-f, --format <format>', '导出格式: json 或 csv', 'json')
  .action((sampleId, options) => {
    const format = options.format === 'csv' ? 'csv' : 'json';
    handler.export(sampleId, format);
  });

program
  .command('validate-rules')
  .alias('vr')
  .description('验证国家规则配置是否可靠')
  .action(() => {
    handler.validateRules();
  });

program
  .command('validate-materials <sample-id>')
  .alias('vm')
  .description('验证样品材料清单是否生效')
  .action((sampleId) => {
    handler.validateMaterials(sampleId);
  });

program.addHelpText('after', `

${chalk.blue.bold('常见使用场景:')}

  ${chalk.gray('1. 首次使用 - 初始化示例数据')}
     customs-checker init

  ${chalk.gray('2. 查看所有样品')}
     customs-checker list

  ${chalk.gray('3. 检查样品材料（正常处理）')}
     customs-checker check sample-complete-001

  ${chalk.gray('4. 检查缺少材料的样品（失败原因）')}
     customs-checker check sample-missing-002

  ${chalk.gray('5. 查看检查历史（修正后重跑）')}
     customs-checker history sample-missing-002

  ${chalk.gray('6. 导出结果为JSON')}
     customs-checker export sample-complete-001

  ${chalk.gray('7. 导出历史为CSV')}
     customs-checker export sample-complete-001 -f csv

${chalk.blue.bold('检查状态说明:')}
  ${chalk.green('✓ 通过')}         - 所有必要材料齐全且有效
  ${chalk.red('✗ 未通过')}       - 缺少必要材料或材料无效，将卡关
  ${chalk.magenta('⚠ 需人工审核')}   - 材料齐全但有警告（如价值超标）

${chalk.blue.bold('必需材料:')}
  • 商业发票 (Invoice)
  • 成分说明 (Composition)  
  • 用途声明 (Declaration)

${chalk.blue.bold('支持的目的国:')}
  US(美国), EU(欧盟), JP(日本), CN(中国), AU(澳大利亚), UK(英国)
`);

program.parse(process.argv);
