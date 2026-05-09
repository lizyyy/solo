import chalk from 'chalk';
import moment from 'moment';
import {
  isInitialized,
  getCheckResultById,
  saveReplayTask,
  updateReplayTask,
  getReplayTaskById,
  addHistoryEntry,
} from '../storage/store';

const simulateReplay = (productIds: string[]): { success: string[]; failed: string[] } => {
  const success: string[] = [];
  const failed: string[] = [];

  productIds.forEach((id, index) => {
    if (index % 10 === 7) {
      failed.push(id);
    } else {
      success.push(id);
    }
  });

  return { success, failed };
};

export const replayCommand = (
  checkResultId: string,
  options: { name: string; description?: string; dryRun?: boolean; productIds?: string }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    addHistoryEntry('replay', '回放失败', 'failed', '项目未初始化');
    return;
  }

  if (!checkResultId) {
    console.log(chalk.red('✗ 必须指定检查结果 ID'));
    console.log(chalk.gray('   用法: sir replay <检查结果ID> --name <任务名称>'));
    addHistoryEntry('replay', '回放失败', 'failed', '缺少检查结果 ID');
    return;
  }

  if (!options.name) {
    console.log(chalk.red('✗ 必须指定 --name 参数'));
    addHistoryEntry('replay', '回放失败', 'failed', '未指定名称');
    return;
  }

  const checkResult = getCheckResultById(checkResultId);
  if (!checkResult) {
    console.log(chalk.red(`✗ 检查结果不存在: ${checkResultId}`));
    console.log(chalk.gray('   可运行: sir list checks 查看可用检查结果'));
    addHistoryEntry('replay', '回放失败', 'failed', `检查结果不存在: ${checkResultId}`);
    return;
  }

  let targetProductIds: string[];

  if (options.productIds) {
    const specifiedIds = options.productIds.split(',').map((id) => id.trim()).filter(Boolean);
    const issues = checkResult.productDiffs.filter((p) => p.hasIssue).map((p) => p.productId);
    const invalidIds = specifiedIds.filter((id) => !issues.includes(id));

    if (invalidIds.length > 0) {
      console.log(chalk.yellow(`⚠️  以下商品 ID 不在问题商品列表中，将被忽略:`));
      invalidIds.forEach((id) => console.log(chalk.gray(`   - ${id}`)));
    }

    targetProductIds = specifiedIds.filter((id) => issues.includes(id));

    if (targetProductIds.length === 0) {
      console.log(chalk.red('✗ 没有有效的商品 ID 可回放'));
      addHistoryEntry('replay', '回放失败', 'failed', '无有效商品 ID');
      return;
    }
  } else {
    targetProductIds = checkResult.productDiffs
      .filter((p) => p.hasIssue)
      .map((p) => p.productId);

    if (targetProductIds.length === 0) {
      console.log(chalk.yellow('⚠️  该检查结果没有需要回放的问题商品'));
      addHistoryEntry('replay', '回放跳过', 'success', '无问题商品');
      return;
    }
  }

  console.log(chalk.blue('🔄 准备重建回放任务...'));
  console.log(chalk.gray(`   任务名称: ${options.name}`));
  console.log(chalk.gray(`   检查结果: ${checkResultId}`));
  console.log(chalk.gray(`   待回放商品数: ${targetProductIds.length}`));

  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow('📋 预演模式 - 不会实际执行回放'));
    console.log(chalk.gray('   将回放以下商品:'));
    targetProductIds.slice(0, 20).forEach((id, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${id}`));
    });
    if (targetProductIds.length > 20) {
      console.log(chalk.gray(`   ... 还有 ${targetProductIds.length - 20} 个商品`));
    }
    addHistoryEntry(
      'replay',
      `预演回放: ${options.name}`,
      'success',
      `商品数: ${targetProductIds.length}`
    );
    return;
  }

  try {
    console.log(chalk.blue('💾 正在创建回放任务...'));
    const task = saveReplayTask({
      name: options.name,
      description: options.description,
      checkResultId,
      productIds: targetProductIds,
      status: 'pending',
      successCount: 0,
      failedCount: 0,
      errors: [],
    });

    console.log(chalk.blue('▶️  开始执行回放...'));
    const startTime = moment().toISOString();
    updateReplayTask(task.id, { status: 'running', startTime });

    const result = simulateReplay(targetProductIds);

    const endTime = moment().toISOString();
    const finalStatus: 'completed' | 'failed' = result.failed.length > 0 ? 'failed' : 'completed';

    const errors = result.failed.length > 0
      ? [`${result.failed.length} 个商品回放失败: ${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? '...' : ''}`]
      : [];

    updateReplayTask(task.id, {
      status: finalStatus,
      endTime,
      successCount: result.success.length,
      failedCount: result.failed.length,
      errors,
    });

    console.log(chalk.green('✓ 回放任务完成'));
    console.log();
    console.log(chalk.white('📊 执行结果:'));
    console.log(chalk.gray(`   任务 ID: ${task.id}`));
    console.log(chalk.gray(`   状态: ${finalStatus === 'completed' ? chalk.green('成功') : chalk.yellow('部分失败')}`));
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
      'replay',
      `执行回放: ${options.name}`,
      finalStatus === 'completed' ? 'success' : 'failed',
      `成功: ${result.success.length}, 失败: ${result.failed.length}, 任务ID: ${task.id}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 回放失败: ${(e as Error).message}`));
    addHistoryEntry('replay', '回放失败', 'failed', (e as Error).message);
  }
};

export const replayStatusCommand = (taskId: string): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  if (!taskId) {
    console.log(chalk.red('✗ 必须指定任务 ID'));
    return;
  }

  const task = getReplayTaskById(taskId);
  if (!task) {
    console.log(chalk.red(`✗ 任务不存在: ${taskId}`));
    return;
  }

  const statusColor: Record<string, chalk.Chalk> = {
    pending: chalk.blue,
    running: chalk.yellow,
    completed: chalk.green,
    failed: chalk.red,
  };

  console.log(chalk.white('📋 回放任务详情:\n'));
  console.log(chalk.gray(`   名称: ${task.name}`));
  console.log(chalk.gray(`   ID: ${task.id}`));
  console.log(chalk.gray(`   状态: ${statusColor[task.status](task.status)}`));
  console.log(chalk.gray(`   关联检查结果: ${task.checkResultId}`));
  console.log(chalk.gray(`   总商品数: ${task.productIds.length}`));
  console.log(chalk.gray(`   成功: ${task.successCount}`));
  console.log(chalk.gray(`   失败: ${task.failedCount}`));
  if (task.startTime) {
    console.log(chalk.gray(`   开始时间: ${task.startTime}`));
  }
  if (task.endTime) {
    console.log(chalk.gray(`   结束时间: ${task.endTime}`));
  }

  if (task.errors.length > 0) {
    console.log();
    console.log(chalk.yellow('⚠️  错误信息:'));
    task.errors.forEach((err, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${err}`));
    });
  }
};
