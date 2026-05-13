const { Command } = require('commander');
const path = require('path');
const chalk = require('chalk');
const program = new Command();

const config = require('./config');
const scanCommand = require('./commands/scan');
const explainCommand = require('./commands/explain');
const allowDriftCommand = require('./commands/allow-drift');
const compareTemplateCommand = require('./commands/compare-template');
const reportCommand = require('./commands/report');

program
  .name('scaffold-cli')
  .description('工程脚手架一致性检查工具')
  .version('1.0.0');

program
  .option('-t, --template-dir <path>', '模板目录路径', path.resolve(process.cwd(), '../templates'))
  .option('-o, --output <file>', '输出报告文件路径')
  .option('-v, --verbose', '详细输出模式')
  .option('--no-color', '禁用颜色输出');

program
  .command('scan')
  .description('扫描项目目录，检查与模板基线的一致性')
  .argument('<projectPaths...>', '一个或多个项目目录路径')
  .option('-r, --rules <rules>', '指定要检查的规则（逗号分隔）')
  .option('--only-errors', '仅显示错误和警告')
  .action((projectPaths, options) => {
    const globalOpts = program.opts();
    scanCommand.execute(projectPaths, { ...globalOpts, ...options });
  });

program
  .command('explain')
  .description('解释指定规则或问题的详细信息')
  .argument('<ruleId>', '规则ID')
  .action((ruleId) => {
    explainCommand.execute(ruleId);
  });

program
  .command('allow-drift')
  .description('为项目添加允许的漂移配置')
  .argument('<projectPath>', '项目目录路径')
  .argument('<ruleId>', '规则ID')
  .requiredOption('--until <date>', '允许到期日期 (YYYY-MM-DD)')
  .requiredOption('--reason <text>', '允许漂移的理由')
  .option('--approved-by <user>', '批准人')
  .option('--review-required', '是否需要后续复审')
  .action((projectPath, ruleId, options) => {
    const globalOpts = program.opts();
    allowDriftCommand.execute(projectPath, ruleId, { ...globalOpts, ...options });
  });

program
  .command('compare-template')
  .description('比较两个模板版本的差异')
  .argument('<templateA>', '模板A路径 (如 standard/v1.0.0)')
  .argument('<templateB>', '模板B路径 (如 standard/v1.1.0)')
  .action((templateA, templateB) => {
    const globalOpts = program.opts();
    compareTemplateCommand.execute(templateA, templateB, globalOpts);
  });

program
  .command('report')
  .description('生成治理报告，适合平台团队分派整改')
  .argument('<projectPaths...>', '一个或多个项目目录路径')
  .option('--format <format>', '报告格式 (json|markdown)', 'json')
  .option('--group-by <group>', '分组方式 (project|rule|risk)', 'project')
  .action((projectPaths, options) => {
    const globalOpts = program.opts();
    reportCommand.execute(projectPaths, { ...globalOpts, ...options });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('错误:'), err.message);
  if (program.opts().verbose) {
    console.error(err.stack);
  }
  process.exit(1);
});
