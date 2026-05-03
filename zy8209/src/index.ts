#!/usr/bin/env node

import { program } from 'commander';
import { auditCommand } from './commands/audit';

program
  .name('cloud-audit')
  .description('云资源发布前审计 CLI 工具')
  .version('1.0.0');

program
  .command('audit')
  .description('审计 Terraform plan 和 IAM 策略，检测安全风险')
  .option('-p, --plan <path>', 'Terraform plan JSON 文件路径')
  .option('-i, --iam <path>', 'IAM 策略 YAML 文件路径')
  .option('-o, --owners <path>', '资源 owner CSV 文件路径')
  .option('-e, --exceptions <path>', '例外清单文件路径 (JSON/CSV)')
  .option('-O, --output <dir>', '输出目录路径', './output')
  .option('-v, --verbose', '显示详细日志')
  .action(async (options) => {
    try {
      await auditCommand(options);
      console.log('\n审计完成！');
    } catch (error: any) {
      console.error('\n审计失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
