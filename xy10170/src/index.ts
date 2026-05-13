#!/usr/bin/env node

import { Command } from 'commander';
import { executeInit } from './commands/init';
import { executeImport } from './commands/import';
import { executeCheck } from './commands/check';
import { executeHistory } from './commands/history';
import { executeReport } from './commands/report';
import { CertificateType } from './types';

const program = new Command();

program
  .name('cert-audit')
  .description('证书到期批量盘点 CLI - 域名、SSL、供应商资质和员工证书到期提醒')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据目录和数据库')
  .option('--force', '强制重新初始化，覆盖现有数据')
  .action((options) => {
    executeInit(options);
  });

program
  .command('import')
  .description('从文件导入证书数据（支持 CSV、Excel、JSON）')
  .argument('<file>', '要导入的文件路径')
  .option('-s, --source <name>', '数据来源标识', 'manual')
  .option('-t, --type <type>', `默认证书类型 (${Object.values(CertificateType).join('|')})`, 'SSL')
  .option('-m, --mapping <json>', '字段映射 JSON 字符串')
  .option('--dry-run', '试运行，不实际导入数据')
  .action((file, options) => {
    executeImport(file, options);
  });

program
  .command('check')
  .description('检查证书状态和问题（过期、即将到期、重复、缺少责任人等）')
  .option('--merge', '合并检测到的重复证书')
  .option('--auto-merge', '自动合并所有重复证书（等同于 --merge）')
  .option('--fix', '自动修复证书状态')
  .action((options) => {
    executeCheck(options);
  });

program
  .command('history')
  .description('查看操作历史记录')
  .option('-c, --certificate-id <id>', '按证书ID筛选')
  .option('-a, --action <type>', '按操作类型筛选 (IMPORT|UPDATE|DELETE|MERGE|STATUS_UPDATE)')
  .option('-l, --limit <number>', '显示条数限制', '100')
  .option('-d, --days <number>', '显示最近N天的记录')
  .action((options) => {
    executeHistory({
      ...options,
      limit: options.limit ? parseInt(options.limit) : undefined,
      days: options.days ? parseInt(options.days) : undefined
    });
  });

program
  .command('report')
  .description('生成证书到期盘点报告')
  .option('-f, --format <format>', '报告格式 (html|csv|json)', 'html')
  .option('-o, --output <path>', '输出文件或目录路径')
  .option('-w, --windows <days>', '到期窗口天数，逗号分隔，如 7,14,30,90')
  .option('-t, --types <types>', '证书类型过滤，逗号分隔')
  .option('--include-expired', '包含已过期证书')
  .option('--no-reminders', '不生成到期提醒部分')
  .action((options) => {
    executeReport(options);
  });

program.addHelpText('after', `

示例:
  # 初始化系统
  $ cert-audit init

  # 从 CSV 文件导入证书
  $ cert-audit import certificates.csv --source "SSL供应商清单"

  # 从 Excel 导入，使用自定义字段映射
  $ cert-audit import data.xlsx --mapping '{"name":"证书名称","type":"证书类型"}'

  # 试运行导入，检查数据有效性
  $ cert-audit import data.json --dry-run

  # 检查证书状态
  $ cert-audit check

  # 检查并自动修复/合并
  $ cert-audit check --merge --fix

  # 查看所有历史记录
  $ cert-audit history

  # 查看特定证书的操作记录
  $ cert-audit history --certificate-id abc123

  # 查看最近7天的操作
  $ cert-audit history --days 7

  # 生成 HTML 报告
  $ cert-audit report

  # 生成 CSV 报告到指定目录
  $ cert-audit report --format csv --output ./reports/

  # 生成包含已过期证书的 JSON 报告
  $ cert-audit report --format json --include-expired

  # 指定到期窗口
  $ cert-audit report --windows 7,14,30,90

证书类型:
  SSL       - SSL/TLS 证书
  DOMAIN    - 域名
  VENDOR    - 供应商资质
  EMPLOYEE  - 员工证书

数据目录:
  默认位置: ~/.cert-audit/
  环境变量: CERT_AUDIT_DATA_DIR
`);

program.parse(process.argv);
