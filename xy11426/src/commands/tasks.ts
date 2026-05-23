import { getPendingTasks, getRetryTasks, getManualTasks, getFailedTasks, retryTask, setManualTask } from '../services/taskService';
import { isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';
import Table from 'cli-table3';
import { TaskStatus } from '../types';

interface TasksOptions {
  status?: string;
  retry?: string;
  manual?: string;
}

export async function tasksCommand(options: TasksOptions): Promise<number> {
  if (!isDatabaseInitialized()) {
    console.error(chalk.red('错误: 请先运行 init 命令初始化数据库'));
    return 1;
  }

  if (options.retry) {
    try {
      retryTask(options.retry);
      console.log(chalk.green(`✓ 任务 ${options.retry} 已标记为重试`));
      return 0;
    } catch (error) {
      console.error(chalk.red('重试失败:'), (error as Error).message);
      return 1;
    }
  }

  if (options.manual) {
    try {
      setManualTask(options.manual);
      console.log(chalk.green(`✓ 任务 ${options.manual} 已标记为等待人工处理`));
      return 0;
    } catch (error) {
      console.error(chalk.red('设置失败:'), (error as Error).message);
      return 1;
    }
  }

  let tasks: any[] = [];
  let title = '';

  switch (options.status) {
    case 'pending':
      tasks = getPendingTasks();
      title = '等待执行的任务';
      break;
    case 'retry':
      tasks = getRetryTasks();
      title = '等待重试的任务';
      break;
    case 'manual':
      tasks = getManualTasks();
      title = '等待人工处理的任务';
      break;
    case 'failed':
      tasks = getFailedTasks();
      title = '永久失败的任务';
      break;
    default:
      const allTasks = [
        ...getPendingTasks(),
        ...getRetryTasks(),
        ...getManualTasks(),
        ...getFailedTasks()
      ];
      tasks = allTasks;
      title = '所有任务';
  }

  if (tasks.length === 0) {
    console.log(chalk.yellow(`暂无${title}`));
    return 0;
  }

  console.log(chalk.cyan(`${title} (共 ${tasks.length} 条):`));
  console.log('');

  const table = new Table({
    head: ['任务ID', '批次ID', '类型', '状态', '重试次数', '错误信息', '创建时间'],
    colWidths: [38, 38, 15, 12, 8, 30, 20]
  });

  const statusColors: Record<string, chalk.Chalk> = {
    [TaskStatus.PENDING]: chalk.blue,
    [TaskStatus.PROCESSING]: chalk.cyan,
    [TaskStatus.RETRY]: chalk.yellow,
    [TaskStatus.MANUAL]: chalk.magenta,
    [TaskStatus.PERMANENT_FAILED]: chalk.red,
    [TaskStatus.COMPLETED]: chalk.green,
  };

  for (const task of tasks) {
    const colorFn = statusColors[task.status] || chalk.gray;
    table.push([
      task.id.substring(0, 36),
      (task.batch_id || '-').substring(0, 36),
      task.task_type,
      colorFn(task.status),
      `${task.retry_count}/${task.max_retries}`,
      (task.error_message || '-').substring(0, 28),
      task.created_at
    ]);
  }

  console.log(table.toString());
  console.log('');
  console.log(chalk.gray('状态说明:'));
  console.log(chalk.blue('  pending    ') + ': 等待执行');
  console.log(chalk.cyan('  processing ') + ': 执行中');
  console.log(chalk.yellow('  retry      ') + ': 等待重试');
  console.log(chalk.magenta('  manual     ') + ': 等待人工处理');
  console.log(chalk.red('  permanent_failed ') + ': 永久失败');
  console.log(chalk.green('  completed  ') + ': 已完成');

  return 0;
}
