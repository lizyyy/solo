import chalk from 'chalk';
import moment from 'moment';
import {
  isInitialized,
  getReplayTaskById,
  getCheckResultById,
  saveCacheRecord,
  addHistoryEntry,
} from '../storage/store';

const simulateCacheRefresh = (productIds: string[]): { success: string[]; failed: string[] } => {
  const success: string[] = [];
  const failed: string[] = [];

  productIds.forEach((id, index) => {
    if (index % 15 === 11) {
      failed.push(id);
    } else {
      success.push(id);
    }
  });

  return { success, failed };
};

export const cacheRefreshCommand = (
  options: {
    replayTaskId?: string;
    checkResultId?: string;
    productIds?: string;
    name?: string;
    dryRun?: boolean;
  }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    addHistoryEntry('cache', '缓存刷新失败', 'failed', '项目未初始化');
    return;
  }

  let targetProductIds: string[] = [];
  let sourceType = '';
  let sourceId = '';

  if (options.replayTaskId) {
    const task = getReplayTaskById(options.replayTaskId);
    if (!task) {
      console.log(chalk.red(`✗ 回放任务不存在: ${options.replayTaskId}`));
      addHistoryEntry('cache', '缓存刷新失败', 'failed', `回放任务不存在: ${options.replayTaskId}`);
      return;
    }
    targetProductIds = task.productIds;
    sourceType = '回放任务';
    sourceId = task.id;
  } else if (options.checkResultId) {
    const result = getCheckResultById(options.checkResultId);
    if (!result) {
      console.log(chalk.red(`✗ 检查结果不存在: ${options.checkResultId}`));
      addHistoryEntry('cache', '缓存刷新失败', 'failed', `检查结果不存在: ${options.checkResultId}`);
      return;
    }
    targetProductIds = result.productDiffs
      .filter((p) => p.hasIssue)
      .map((p) => p.productId);
    sourceType = '检查结果';
    sourceId = result.id;
  } else if (options.productIds) {
    targetProductIds = options.productIds.split(',').map((id) => id.trim()).filter(Boolean);
    sourceType = '手动指定';
    sourceId = 'manual';
  }

  if (targetProductIds.length === 0) {
    console.log(chalk.red('✗ 未指定任何商品 ID'));
    console.log(chalk.gray('   使用 --replay-task-id, --check-result-id, 或 --product-ids 指定'));
    addHistoryEntry('cache', '缓存刷新失败', 'failed', '无商品 ID');
    return;
  }

  console.log(chalk.blue('🗄️  准备缓存刷新...'));
  console.log(chalk.gray(`   来源: ${sourceType}`));
  if (sourceId !== 'manual') {
    console.log(chalk.gray(`   来源 ID: ${sourceId}`));
  }
  console.log(chalk.gray(`   待刷新商品数: ${targetProductIds.length}`));

  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow('📋 预演模式 - 不会实际刷新缓存'));
    console.log(chalk.gray('   将刷新以下商品:'));
    targetProductIds.slice(0, 20).forEach((id, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${id}`));
    });
    if (targetProductIds.length > 20) {
      console.log(chalk.gray(`   ... 还有 ${targetProductIds.length - 20} 个商品`));
    }
    addHistoryEntry(
      'cache',
      `预演缓存刷新 (${sourceType})`,
      'success',
      `商品数: ${targetProductIds.length}`
    );
    return;
  }

  try {
    console.log(chalk.blue('▶️  开始刷新缓存...'));
    const result = simulateCacheRefresh(targetProductIds);

    const status: 'success' | 'failed' | 'partial' =
      result.failed.length === 0
        ? 'success'
        : result.success.length === 0
        ? 'failed'
        : 'partial';

    const errors = result.failed.length > 0
      ? [`${result.failed.length} 个商品缓存刷新失败: ${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? '...' : ''}`]
      : [];

    console.log(chalk.blue('💾 正在保存刷新记录...'));
    const record = saveCacheRecord({
      timestamp: moment().toISOString(),
      productIds: targetProductIds,
      status,
      refreshedCount: result.success.length,
      failedCount: result.failed.length,
      errors,
    });

    const statusColor: Record<string, chalk.Chalk> = {
      success: chalk.green,
      failed: chalk.red,
      partial: chalk.yellow,
    };

    console.log(chalk.green('✓ 缓存刷新完成'));
    console.log();
    console.log(chalk.white('📊 刷新结果:'));
    console.log(chalk.gray(`   记录 ID: ${record.id}`));
    console.log(chalk.gray(`   状态: ${statusColor[status](status)}`));
    console.log(chalk.gray(`   成功: ${result.success.length}`));
    console.log(chalk.gray(`   失败: ${result.failed.length}`));

    if (result.failed.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠️  失败的商品 ID (最多 10 个):'));
      result.failed.slice(0, 10).forEach((id) => {
        console.log(chalk.gray(`   - ${id}`));
      });
    }

    addHistoryEntry(
      'cache',
      `执行缓存刷新 (${sourceType})`,
      status === 'failed' ? 'failed' : 'success',
      `成功: ${result.success.length}, 失败: ${result.failed.length}, 记录ID: ${record.id}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 缓存刷新失败: ${(e as Error).message}`));
    addHistoryEntry('cache', '缓存刷新失败', 'failed', (e as Error).message);
  }
};
