import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import prompts from 'prompts';
import { ReviewStorage } from '../../storage/review-storage';
import { CheckResult, Issue, IssueStatus, ReviewSession, ReviewItem } from '../../types';

export const reviewCommand = new Command('review')
  .description('人工复核问题，可确认或忽略问题')
  .option('-c, --check-result <path>', '检查结果路径', '.foi-output/check-result.json')
  .option('-o, --output <path>', '输出目录', '.foi-output')
  .option('--all', '复核所有问题（包括已处理过的')
  .option('--only-new', '只复核新问题')
  .option('--interactive', '交互式复核 (默认)', true)
  .option('--list', '仅列出问题，不进入复核')
  .option('--set-status <issueId:status>', '设置单个问题状态，格式: issueId:status (confirmed/ignored)')
  .action(async (options: {
    checkResult: string;
    output: string;
    all: boolean;
    onlyNew: boolean;
    interactive: boolean;
    list: boolean;
    setStatus: string;
  }) => {
    console.log(chalk.blue('焦点顺序体检员 - 人工复核'));
    console.log('='.repeat(50));

    try {
      const checkResultPath = path.resolve(options.checkResult);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(checkResultPath)) {
        throw new Error(`找不到检查结果: ${checkResultPath}。请先运行 "foi check" 命令。`);
      }

      const checkResultContent = fs.readFileSync(checkResultPath, 'utf-8');
      const checkResult: CheckResult = JSON.parse(checkResultContent);

      const storage = new ReviewStorage(outputDir);
      let reviewSession = storage.load(checkResult.scanResult.snapshotId);

      console.log(chalk.green(`[✓] 加载检查结果: ${checkResult.scanResult.snapshotId}`));
      console.log(`    总问题数: ${checkResult.issues.length}`);
      if (reviewSession) {
        console.log(`    已复核: ${reviewSession.issues.length} 项`);
      }

      if (options.setStatus) {
        await setSingleIssueStatus(options.setStatus, checkResult, storage, outputDir);
        return;
      }

      if (options.list) {
        listIssues(checkResult, reviewSession);
        return;
      }

      if (options.interactive) {
        await interactiveReview(checkResult, reviewSession, storage, outputDir, options);
      }

    } catch (error) {
      console.error(chalk.red(`错误: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function listIssues(checkResult: CheckResult, reviewSession: ReviewSession | null): void {
  console.log('\n问题列表:');
  console.log('-'.repeat(50));

  const statusColors: Record<IssueStatus, (text: string) => string> = {
    new: chalk.gray,
    confirmed: chalk.red,
    ignored: chalk.yellow,
    fixed: chalk.green
  };

  const statusLabels: Record<IssueStatus, string> = {
    new: '新问题',
    confirmed: '已确认',
    ignored: '已忽略',
    fixed: '已修复'
  };

  checkResult.issues.forEach((issue, index) => {
    const reviewItem = reviewSession?.issues.find(r => r.issueId === issue.id);
    const status = reviewItem?.status || 'new';
    const colorFn = statusColors[status];

    console.log(`\n${index + 1}. [${colorFn(statusLabels[status])}] ${issue.title}`);
    console.log(`   ID: ${issue.id}`);
    console.log(`   类型: ${issue.type}`);
    console.log(`   严重级别: ${issue.severity}`);
    console.log(`   元素: ${issue.element.selector}`);
    if (reviewItem?.reviewerNote) {
      console.log(`   复核备注: ${reviewItem.reviewerNote}`);
    }
  });

  const stats = calculateReviewStats(checkResult.issues, reviewSession);
  console.log('\n' + '='.repeat(50));
  console.log('复核统计:');
  console.log(`  新问题: ${stats.new} 个`);
  console.log(`  已确认: ${stats.confirmed} 个`);
  console.log(`  已忽略: ${stats.ignored} 个`);
  console.log(`  已修复: ${stats.fixed} 个`);
}

function calculateReviewStats(issues: Issue[], session: ReviewSession | null) {
  const stats = { new: 0, confirmed: 0, ignored: 0, fixed: 0 };
  issues.forEach(issue => {
    const reviewItem = session?.issues.find(r => r.issueId === issue.id);
    const status = reviewItem?.status || 'new';
    stats[status]++;
  });
  return stats;
}

async function setSingleIssueStatus(
  statusSpec: string,
  checkResult: CheckResult,
  storage: ReviewStorage,
  outputDir: string
): Promise<void> {
  const [issueId, statusStr] = statusSpec.split(':');
  
  if (!issueId || !statusStr) {
    throw new Error('格式错误。正确格式: --set-status issueId:status');
  }

  const status = statusStr.toLowerCase() as IssueStatus;
  if (!['confirmed', 'ignored', 'fixed', 'new'].includes(status)) {
    throw new Error(`无效的状态。可用状态: confirmed, ignored, fixed, new');
  }

  const issue = checkResult.issues.find(i => i.id === issueId);
  if (!issue) {
    throw new Error(`找不到问题 ID: ${issueId}`);
  }

  let reviewSession = storage.load(checkResult.scanResult.snapshotId) || {
    id: `review-${Date.now()}`,
    snapshotId: checkResult.scanResult.snapshotId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issues: []
  };

  const existingIndex = reviewSession.issues.findIndex(r => r.issueId === issueId);
  const reviewItem: ReviewItem = {
    issueId,
    status,
    reviewedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    reviewSession.issues[existingIndex] = reviewItem;
  } else {
    reviewSession.issues.push(reviewItem);
  }

  reviewSession.updatedAt = new Date().toISOString();
  storage.save(reviewSession);

  console.log(chalk.green(`[✓] 已设置问题 ${issueId} 状态为: ${status}`));
}

async function interactiveReview(
  checkResult: CheckResult,
  reviewSession: ReviewSession | null,
  storage: ReviewStorage,
  outputDir: string,
  options: { all: boolean; onlyNew: boolean }
): Promise<void> {
  const session = reviewSession || {
    id: `review-${Date.now()}`,
    snapshotId: checkResult.scanResult.snapshotId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issues: []
  };

  let issuesToReview = checkResult.issues;

  if (options.onlyNew) {
    issuesToReview = issuesToReview.filter(issue => {
      const reviewItem = session.issues.find(r => r.issueId === issue.id);
      return !reviewItem || reviewItem.status === 'new';
    });
  }

  if (issuesToReview.length === 0) {
    console.log(chalk.green('没有需要复核的问题'));
    return;
  }

  console.log(chalk.cyan(`\n开始交互复核，共 ${issuesToReview.length} 个问题`));
  console.log(chalk.gray('操作: c=确认, i=忽略, f=已修复, s=跳过, q=退出'));

  for (let i = 0; i < issuesToReview.length; i++) {
    const issue = issuesToReview[i];
    const existingReview = session.issues.find(r => r.issueId === issue.id);

    console.log('\n' + '='.repeat(50));
    console.log(chalk.cyan(`问题 ${i + 1}/${issuesToReview.length}`));
    console.log(`ID: ${issue.id}`);
    console.log(`标题: ${issue.title}`);
    console.log(`类型: ${issue.type}`);
    console.log(`严重级别: ${issue.severity}`);
    console.log(`描述: ${issue.description}`);
    console.log(`元素: ${issue.element.selector}`);
    console.log(`建议: ${issue.suggestion}`);

    if (existingReview) {
      console.log(chalk.yellow(`\n当前状态: ${existingReview.status}`));
      if (existingReview.reviewerNote) {
        console.log(chalk.yellow(`备注: ${existingReview.reviewerNote}`));
      }
    }

    const response = await prompts({
      type: 'select',
      name: 'action',
      message: '选择操作:',
      choices: [
        { title: '确认问题 (c)', value: 'confirmed', description: '确认这是一个需要修复的问题' },
        { title: '忽略问题 (i)', value: 'ignored', description: '标记为误报或无需处理' },
        { title: '已修复 (f)', value: 'fixed', description: '问题已修复' },
        { title: '跳过 (s)', value: 'skip', description: '暂时跳过，稍后处理' },
        { title: '退出 (q)', value: 'quit', description: '保存并退出' }
      ],
      initial: 0
    });

    if (response.action === 'quit') {
      break;
    }

    if (response.action !== 'skip') {
      const noteResponse = await prompts({
        type: 'text',
        name: 'note',
        message: '添加备注 (可选):',
        initial: ''
      });

      const reviewItem: ReviewItem = {
        issueId: issue.id,
        status: response.action as IssueStatus,
        reviewerNote: noteResponse.note || undefined,
        reviewedAt: new Date().toISOString()
      };

      const existingIndex = session.issues.findIndex(r => r.issueId === issue.id);
      if (existingIndex >= 0) {
        session.issues[existingIndex] = reviewItem;
      } else {
        session.issues.push(reviewItem);
      }

      session.updatedAt = new Date().toISOString();
      storage.save(session);

      console.log(chalk.green('[✓] 已保存复核结果'));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(chalk.green('复核完成！'));
  
  const stats = calculateReviewStats(checkResult.issues, session);
  console.log(`\n复核统计:`);
  console.log(`  新问题: ${stats.new} 个`);
  console.log(`  已确认: ${stats.confirmed} 个`);
  console.log(`  已忽略: ${stats.ignored} 个`);
  console.log(`  已修复: ${stats.fixed} 个`);
}
