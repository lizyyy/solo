import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import moment from 'moment';
import { getDatabase } from '../database';

interface HistoryOptions {
  limit?: number;
  batch?: string;
}

export async function historyCommand(workDir: string, options: HistoryOptions): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);

  if (options.batch) {
    await showBatchDetail(db, options.batch);
    return;
  }

  const history = await db.getImportHistory(options.limit || 50);

  console.log(chalk.blue('导入历史记录'));
  console.log('');

  if (history.length === 0) {
    console.log(chalk.gray('暂无导入记录'));
    return;
  }

  const table = new Table({
    head: ['批次号', '源文件', '类型', '总数', '已处理', '状态', '时间'],
    colWidths: [12, 22, 12, 8, 10, 10, 20],
  });

  for (const session of history) {
    const statusColor = session.status === 'completed' ? chalk.green : chalk.red;
    table.push([
      session.batchId,
      session.sourceFile,
      session.sourceType,
      session.totalRecords.toString(),
      session.processedRecords.toString(),
      statusColor(session.status),
      moment(session.startedAt).format('YYYY-MM-DD HH:mm'),
    ]);
  }

  console.log(table.toString());
  console.log('');
  console.log(chalk.gray(`使用 pmi history --batch <批次号> 查看批次详情`));
}

async function showBatchDetail(db: any, batchId: string): Promise<void> {
  const session = await db.getSessionById(batchId);
  if (!session) {
    console.log(chalk.red(`批次 ${batchId} 不存在`));
    return;
  }

  console.log(chalk.blue(`批次详情: ${batchId}`));
  console.log('');

  const infoTable = new Table({
    colWidths: [20, 60],
  });

  infoTable.push(
    ['批次号', session.batchId],
    ['源文件', session.sourceFile],
    ['数据类型', session.sourceType],
    ['状态', session.status],
    ['总记录数', session.totalRecords.toString()],
    ['已处理', session.processedRecords.toString()],
    ['开始时间', moment(session.startedAt).format('YYYY-MM-DD HH:mm:ss')],
    ['完成时间', session.completedAt ? moment(session.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-']
  );

  console.log(infoTable.toString());
  console.log('');

  const records = await db.getRawRecordsByBatch(batchId);
  console.log(chalk.yellow(`记录列表 (${records.length} 条):`));

  const recordsTable = new Table({
    head: ['记录ID', '行号', '状态', '内容摘要'],
    colWidths: [14, 8, 12, 56],
    wordWrap: true,
  });

  for (const record of records) {
    const content = JSON.parse(record.rawContent);
    const contentSummary = Object.values(content).join(' ').substring(0, 50);
    const statusColor = getStatusColor(record.status);
    recordsTable.push([
      record.id,
      record.rawLineNumber.toString(),
      statusColor(record.status),
      contentSummary,
    ]);
  }

  console.log(recordsTable.toString());
}

function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'imported':
      return chalk.green;
    case 'failed':
      return chalk.red;
    case 'fixed':
      return chalk.blue;
    case 'withdrawn':
      return chalk.gray;
    case 'pending':
      return chalk.yellow;
    default:
      return chalk.white;
  }
}
