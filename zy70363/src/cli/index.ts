#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadSnapshot, loadRules, loadAcceptedIssues, addAcceptedIssue } from '../loaders/loaders';
import { performAudit, explainKey } from '../auditor/auditor';
import { printScanResult, printKeyExplanation, printSuggestion, printReport } from './printer';
import { parseDateToTimestamp } from '../utils/ttl';
import { AcceptedIssue, IssueType } from '../types';
const chalk = require('chalk');

const VALID_ISSUE_TYPES: IssueType[] = [
  'no_ttl',
  'ttl_too_long',
  'ttl_too_short',
  'invalid_name',
  'policy_mismatch',
  'inconsistent_policy',
];

function loadRequiredArgs(argv: { snapshot?: string; rules?: string; dataDir: string }) {
  if (!argv.snapshot) {
    console.error(chalk.red('错误: 必须指定 --snapshot 参数'));
    process.exit(1);
  }
  if (!argv.rules) {
    console.error(chalk.red('错误: 必须指定 --rules 参数'));
    process.exit(1);
  }
  
  const snapshot = loadSnapshot(argv.snapshot);
  const rules = loadRules(argv.rules);
  const accepted = loadAcceptedIssues(argv.dataDir);
  
  return { snapshot, rules, accepted };
}

const parser = yargs(hideBin(process.argv))
  .scriptName('redis-ttl-audit')
  .usage('$0 <命令> [选项]')
  .option('snapshot', {
    type: 'string',
    describe: 'Redis key 快照文件路径 (JSON)',
    demandOption: false,
  })
  .option('rules', {
    type: 'string',
    describe: '审计规则文件路径 (JSON)',
    demandOption: false,
  })
  .option('dataDir', {
    type: 'string',
    describe: '数据存储目录（用于保存豁免记录）',
    default: './data',
  });

parser.command(
  'scan',
  '扫描快照并发现问题',
  (y) => y,
  (argv) => {
    const args = argv as { snapshot?: string; rules?: string; dataDir: string };
    const { snapshot, rules, accepted } = loadRequiredArgs(args);
    const report = performAudit(snapshot, rules, accepted);
    printScanResult(report);
  }
);

parser.command(
  'explain <key>',
  '详细解释某个 key 的风险',
  (y) => y.positional('key', { type: 'string', describe: '要解释的 Redis key' }),
  (argv) => {
    const args = argv as { key: string; snapshot?: string; rules?: string; dataDir: string };
    const { snapshot, rules, accepted } = loadRequiredArgs(args);
    const explanation = explainKey(args.key, snapshot, rules, accepted);
    printKeyExplanation(explanation);
  }
);

parser.command(
  'suggest <key>',
  '给出优化建议',
  (y) => y.positional('key', { type: 'string', describe: '要建议的 Redis key' }),
  (argv) => {
    const args = argv as { key: string; snapshot?: string; rules?: string; dataDir: string };
    const { snapshot, rules, accepted } = loadRequiredArgs(args);
    const explanation = explainKey(args.key, snapshot, rules, accepted);
    
    if (!explanation) {
      console.log(chalk.red('Key 未在快照中找到'));
      return;
    }
    
    if (explanation.issues.length === 0) {
      console.log(chalk.green('该 key 没有问题，无需优化建议'));
      return;
    }
    
    for (const issue of explanation.issues) {
      printSuggestion(issue);
    }
  }
);

parser.command(
  'mark-accepted',
  '标记问题为已接受/豁免',
  (y) =>
    y
      .option('key', { type: 'string', describe: '要豁免的 key', demandOption: true })
      .option('issueType', { type: 'string', describe: '问题类型', demandOption: true, choices: VALID_ISSUE_TYPES })
      .option('reason', { type: 'string', describe: '豁免原因', demandOption: true })
      .option('expireDate', { type: 'string', describe: '豁免到期日期', demandOption: true })
      .option('by', { type: 'string', describe: '执行人', default: 'cli' }),
  (argv) => {
    const args = argv as {
      key: string;
      issueType: string;
      reason: string;
      expireDate: string;
      by: string;
      dataDir: string;
    };
    const key = args.key;
    const issueType = args.issueType as IssueType;
    const reason = args.reason;
    const expireDateStr = args.expireDate;
    const by = args.by;
    
    let expiresAt: number;
    try {
      expiresAt = parseDateToTimestamp(expireDateStr);
      if (isNaN(expiresAt) || expiresAt <= 0) {
        throw new Error('无效的日期格式');
      }
    } catch (e) {
      console.error(chalk.red(`错误: 无效的日期格式 "${expireDateStr}"`));
      console.error('请使用格式: YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss');
      process.exit(1);
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt <= now) {
      console.error(chalk.red('错误: 到期日期必须在未来'));
      process.exit(1);
    }
    
    const issue: AcceptedIssue = {
      key,
      issueType,
      reason,
      acceptedAt: now,
      expiresAt,
      acceptedBy: by,
    };
    
    addAcceptedIssue(issue, args.dataDir);
    
    console.log(chalk.green(`✓ 已添加豁免记录`));
    console.log(`  Key: ${key}`);
    console.log(`  问题类型: ${issueType}`);
    console.log(`  原因: ${reason}`);
    console.log(`  到期: ${expireDateStr}`);
    console.log(`  执行人: ${by}`);
  }
);

parser.command(
  'report',
  '生成完整报告',
  (y) => y.option('json', { type: 'boolean', describe: '输出 JSON 格式', default: false }),
  (argv) => {
    const args = argv as { snapshot?: string; rules?: string; dataDir: string; json: boolean };
    const { snapshot, rules, accepted } = loadRequiredArgs(args);
    const report = performAudit(snapshot, rules, accepted);
    printReport(report, args.json);
  }
);

parser
  .example('$0 scan --snapshot snapshot.json --rules rules.json', '扫描快照')
  .example('$0 explain "session:user:123" --snapshot snapshot.json --rules rules.json', '解释特定 key')
  .example('$0 suggest "session:user:123" --snapshot snapshot.json --rules rules.json', '获取优化建议')
  .example('$0 mark-accepted --key "config:app" --issueType no_ttl --reason "永久配置" --expireDate "2026-12-31"', '豁免问题')
  .example('$0 report --snapshot snapshot.json --rules rules.json --json', '生成 JSON 报告')
  .epilogue('Redis Key 过期审计工具 - 帮助你发现和管理 Redis TTL 问题')
  .demandCommand(1, '请指定一个命令')
  .help()
  .alias('h', 'help')
  .version('1.0.0')
  .alias('v', 'version')
  .strict()
  .parse();
