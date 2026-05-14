import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { Storage } from '../storage';
import { ProcessingStatus, AbnormalType } from '../types';

export async function previewBatchProcess(batchId: string): Promise<void> {
  const batch = Storage.getBatchById(batchId);
  if (!batch) {
    console.log(chalk.red(`批次 ${batchId} 不存在`));
    return;
  }

  const records = Storage.queryRecords({ batchId });
  const pendingRecords = records.filter(r => r.status === ProcessingStatus.PENDING);
  
  console.log(chalk.blue.bold(`\n批量处理预览 - 批次: ${batchId}\n`));
  console.log(chalk.white(`批次名称: ${batch.batchName}`));
  console.log(chalk.white(`来源: ${batch.source}`));
  console.log(chalk.white(`处理依据: ${batch.processingBasis}`));
  console.log(chalk.yellow(`\n待处理记录: ${pendingRecords.length} 条`));

  if (pendingRecords.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('客户姓名'),
        chalk.cyan('客服'),
        chalk.cyan('录音ID'),
        chalk.cyan('摘要')
      ],
      colWidths: [12, 12, 10, 15, 30]
    });

    pendingRecords.forEach(record => {
      table.push([
        record.id.substring(0, 8),
        record.customerName,
        record.agentName,
        record.recordingId,
        record.summary.substring(0, 25) + '...'
      ]);
    });

    console.log(table.toString());
  }

  console.log(chalk.blue(`\n预览完成。使用 --execute 参数执行批量处理`));
}

export async function executeBatchProcess(batchId: string): Promise<void> {
  await previewBatchProcess(batchId);
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow('确认要执行批量处理吗？'),
      default: false
    }
  ]);

  if (!answers.confirm) {
    console.log(chalk.gray('已取消操作'));
    return;
  }

  const records = Storage.queryRecords({ batchId, status: ProcessingStatus.PENDING });
  
  let successCount = 0;
  let abnormalCount = 0;

  for (const record of records) {
    const truncatedFields: string[] = [];
    
    if (record.summary.length < 10 && record.summary.length > 0) {
      truncatedFields.push('summary');
    }
    if (record.customerName.includes('...')) {
      truncatedFields.push('customerName');
    }
    const hasTruncatedField = record.isFieldTruncated || truncatedFields.length > 0;

    if (hasTruncatedField) {
      const allTruncatedFields = [...new Set([...(record.truncatedFields || []), ...truncatedFields])];
      Storage.updateRecord(record.id, {
        status: ProcessingStatus.ABNORMAL,
        abnormalType: AbnormalType.FIELD_TRUNCATED,
        abnormalReason: '批处理检测到字段截断，需要人工复核',
        isFieldTruncated: true,
        truncatedFields: allTruncatedFields,
        processingResult: '字段截断，需要人工复核'
      });
      abnormalCount++;
      console.log(chalk.red(`  ${record.id.substring(0, 8)} - 标记为异常: 字段截断 (${allTruncatedFields.join(', ')})`));
    } else {
      Storage.updateRecord(record.id, {
        status: ProcessingStatus.SUCCESS,
        processingResult: '处理成功'
      });
      successCount++;
      console.log(chalk.green(`  ${record.id.substring(0, 8)} - 处理成功`));
    }
  }

  console.log(chalk.blue.bold(`\n批量处理完成!`));
  console.log(chalk.green(`成功: ${successCount} 条`));
  console.log(chalk.red(`异常: ${abnormalCount} 条`));
}

export async function correctRecord(recordId: string): Promise<void> {
  const record = Storage.getRecordById(recordId);
  if (!record) {
    console.log(chalk.red(`记录 ${recordId} 不存在`));
    return;
  }

  console.log(chalk.blue.bold('\n当前记录详情:\n'));
  console.log(chalk.white(`ID: ${record.id}`));
  console.log(chalk.white(`批次号: ${record.batchId}`));
  console.log(chalk.white(`客户姓名: ${record.customerName}`));
  console.log(chalk.white(`客服: ${record.agentName}`));
  console.log(chalk.white(`摘要: ${record.summary}`));
  console.log(chalk.white(`状态: ${record.status}`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'correctedBy',
      message: '修正人姓名:'
    },
    {
      type: 'input',
      name: 'correctionReason',
      message: '修正原因:'
    },
    {
      type: 'input',
      name: 'newSummary',
      message: '修正后的摘要:',
      default: record.summary
    },
    {
      type: 'input',
      name: 'newCustomerName',
      message: '修正后的客户姓名:',
      default: record.customerName
    }
  ]);

  const updated = Storage.manuallyCorrectRecord(
    recordId,
    answers.correctedBy,
    answers.correctionReason,
    {
      summary: answers.newSummary,
      customerName: answers.newCustomerName
    }
  );

  if (updated) {
    console.log(chalk.green.bold('\n人工修正成功!'));
    console.log(chalk.yellow(`修正人: ${updated.correctedBy}`));
    console.log(chalk.yellow(`修正原因: ${updated.correctionReason}`));
    console.log(chalk.yellow(`修正时间: ${updated.correctionTime}`));
  }
}
