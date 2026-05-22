import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import moment from 'moment';
import { getDatabase } from '../database';

export async function showCommand(id: string, workDir: string): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);

  const history = await db.getImportHistory(100);
  let foundRaw = null;

  for (const session of history) {
    const records = await db.getRawRecordsByBatch(session.batchId);
    foundRaw = records.find(r => r.id === id);
    if (foundRaw) break;
  }

  if (!foundRaw) {
    console.log(chalk.red(`记录 ${id} 不存在`));
    return;
  }

  console.log(chalk.blue(`记录详情: ${id}`));
  console.log('');

  const infoTable = new Table({
    colWidths: [20, 60],
  });

  infoTable.push(
    ['记录ID', foundRaw.id],
    ['源文件', foundRaw.sourceFile],
    ['数据类型', foundRaw.sourceType],
    ['原始行号', foundRaw.rawLineNumber.toString()],
    ['状态', getStatusColor(foundRaw.status)(foundRaw.status)],
    ['导入时间', moment(foundRaw.importedAt).format('YYYY-MM-DD HH:mm:ss')],
    ['批次号', foundRaw.importBatchId]
  );

  console.log(chalk.yellow('原始记录信息:'));
  console.log(infoTable.toString());
  console.log('');

  console.log(chalk.yellow('原始内容:'));
  const rawContent = JSON.parse(foundRaw.rawContent);
  const rawTable = new Table({
    head: ['字段', '值'],
    colWidths: [25, 55],
  });

  for (const [key, value] of Object.entries(rawContent)) {
    rawTable.push([key, String(value)]);
  }

  console.log(rawTable.toString());
  console.log('');

  const allStdRecords: any[] = [];
  const stdRecordsAll = await db.getStandardizedRecordsByFact('');
  for (const s of stdRecordsAll) {
    if (s.rawRecordId === foundRaw.id) {
      allStdRecords.push(s);
    }
  }

  if (allStdRecords.length > 0) {
    console.log(chalk.yellow('标准化数据:'));
    const stdTable = new Table({
      head: ['字段', '值'],
      colWidths: [25, 55],
    });

    const std = allStdRecords[0];
    const stdFields = [
      ['工单号', std.orderNumber],
      ['住户姓名', std.residentName],
      ['房间号', std.roomNumber],
      ['联系电话', std.phoneNumber],
      ['维修类型', std.repairType],
      ['问题描述', std.description],
      ['报修时间', std.reportTime ? moment(std.reportTime).format('YYYY-MM-DD HH:mm') : ''],
      ['维修师傅', std.technicianName],
      ['到达时间', std.arrivalTime ? moment(std.arrivalTime).format('YYYY-MM-DD HH:mm') : ''],
      ['完成时间', std.completionTime ? moment(std.completionTime).format('YYYY-MM-DD HH:mm') : ''],
      ['维修结果', std.repairResult],
      ['材料名称', std.materialName],
      ['材料数量', std.materialQuantity],
      ['单位', std.materialUnit],
      ['主管批注', std.supervisorNote],
      ['置信度', std.confidence.toFixed(2)],
      ['人工改判', std.isManualOverride ? '是' : '否'],
      ['标准化时间', moment(std.standardizedAt).format('YYYY-MM-DD HH:mm:ss')],
      ['标准化人', std.standardizedBy],
    ];

    for (const [field, value] of stdFields) {
      if (value !== undefined && value !== '' && value !== null) {
        stdTable.push([field, String(value)]);
      }
    }

    console.log(stdTable.toString());

    const fact = await db.findFactByOrderNumber(std.orderNumber);
    if (fact) {
      console.log('');
      console.log(chalk.yellow('关联工单事实:'));
      const factTable = new Table({
        colWidths: [20, 60],
      });

      factTable.push(
        ['工单ID', fact.id],
        ['工单号', fact.orderNumber],
        ['当前状态', fact.currentStatus],
        ['版本号', fact.version.toString()],
        ['是否冻结', fact.isFrozen ? chalk.blue('是') : '否'],
        ['创建时间', moment(fact.createdAt).format('YYYY-MM-DD HH:mm:ss')],
        ['更新时间', moment(fact.updatedAt).format('YYYY-MM-DD HH:mm:ss')]
      );

      console.log(factTable.toString());
    }
  }

  const errors = await db.getUnresolvedErrors(foundRaw.id);
  if (errors.length > 0) {
    console.log('');
    console.log(chalk.red('关联错误:'));
    const errTable = new Table({
      head: ['错误ID', '字段', '错误码', '错误信息', '严重程度'],
      colWidths: [14, 12, 16, 32, 10],
    });

    for (const error of errors) {
      errTable.push([
        error.id,
        error.fieldName,
        error.errorCode,
        error.errorMessage,
        error.severity === 'error' ? chalk.red('错误') : chalk.yellow('警告'),
      ]);
    }

    console.log(errTable.toString());
  }
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
