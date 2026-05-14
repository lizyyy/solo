import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Storage } from '../storage';
import { ProcessingStatus, RecordingRecord } from '../types';

const EXPORT_DIR = path.join(process.cwd(), 'exports');

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function recordToCSV(record: RecordingRecord): string {
  const batch = Storage.getBatchById(record.batchId);
  return [
    `"${record.id}"`,
    `"${record.batchId}"`,
    `"${batch?.batchName || ''}"`,
    `"${batch?.source || ''}"`,
    `"${batch?.processingBasis || ''}"`,
    `"${record.recordingId}"`,
    `"${record.customerName}"`,
    `"${record.phoneNumber}"`,
    `"${record.serviceType}"`,
    `"${record.startTime}"`,
    `"${record.endTime}"`,
    `"${record.duration}"`,
    `"${record.agentName}"`,
    `"${record.summary}"`,
    `"${record.status}"`,
    `"${record.abnormalType || ''}"`,
    `"${record.abnormalReason || ''}"`,
    `"${record.correctedBy || ''}"`,
    `"${record.correctionReason || ''}"`,
    `"${record.processingResult || ''}"`
  ].join(',');
}

export function exportRecords(options: any): void {
  ensureExportDir();
  
  const queryOptions: any = {};
  if (options.batch) queryOptions.batchId = options.batch;
  if (options.abnormalOnly) queryOptions.status = ProcessingStatus.ABNORMAL;

  const records = Storage.queryRecords(queryOptions);
  
  if (records.length === 0) {
    console.log(chalk.yellow('没有找到可导出的记录'));
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const format = options.format || 'json';
  
  if (format === 'json') {
    const fileName = `export_${timestamp}.json`;
    const filePath = path.join(EXPORT_DIR, fileName);
    
    const exportData = records.map(record => {
      const batch = Storage.getBatchById(record.batchId);
      return {
        ...record,
        batchInfo: batch ? {
          batchName: batch.batchName,
          source: batch.source,
          processingBasis: batch.processingBasis
        } : null
      };
    });
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(chalk.green(`成功导出 ${records.length} 条记录到: ${filePath}`));
  } else if (format === 'csv') {
    const fileName = `export_${timestamp}.csv`;
    const filePath = path.join(EXPORT_DIR, fileName);
    
    const headers = [
      'ID', '批次号', '批次名称', '来源', '处理依据',
      '录音ID', '客户姓名', '电话号码', '服务类型',
      '开始时间', '结束时间', '时长(秒)', '客服姓名',
      '摘要', '状态', '异常类型', '异常原因',
      '修正人', '修正原因', '处理结果'
    ];
    
    const csvContent = [
      headers.join(','),
      ...records.map(recordToCSV)
    ].join('\n');
    
    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
    console.log(chalk.green(`成功导出 ${records.length} 条记录到: ${filePath}`));
  }

  console.log(chalk.blue.bold('\n导出统计:'));
  console.log(`总计: ${records.length} 条`);
  console.log(`成功记录: ${chalk.green(records.filter(r => r.status === ProcessingStatus.SUCCESS).length)}`);
  console.log(`异常记录: ${chalk.red(records.filter(r => r.status === ProcessingStatus.ABNORMAL).length)}`);
  console.log(`已修正记录: ${chalk.cyan(records.filter(r => r.status === ProcessingStatus.MANUALLY_CORRECTED).length)}`);
}

export function showRecordDetail(recordId: string): void {
  const record = Storage.getRecordById(recordId);
  if (!record) {
    console.log(chalk.red(`记录 ${recordId} 不存在`));
    return;
  }

  const batch = Storage.getBatchById(record.batchId);

  console.log(chalk.blue.bold('\n记录详情:\n'));
  console.log(chalk.cyan('基本信息:'));
  console.log(`  ID: ${record.id}`);
  console.log(`  批次号: ${record.batchId}`);
  if (batch) {
    console.log(`  批次名称: ${batch.batchName}`);
    console.log(`  来源: ${chalk.yellow(batch.source)}`);
    console.log(`  处理依据: ${chalk.yellow(batch.processingBasis)}`);
  }
  console.log(`  录音ID: ${record.recordingId}`);
  console.log(`  客户姓名: ${record.customerName}`);
  console.log(`  电话号码: ${record.phoneNumber}`);
  console.log(`  服务类型: ${record.serviceType}`);
  console.log(`  开始时间: ${record.startTime}`);
  console.log(`  结束时间: ${record.endTime}`);
  console.log(`  时长: ${record.duration} 秒`);
  console.log(`  客服: ${record.agentName}`);

  console.log(chalk.cyan('\n处理信息:'));
  const statusColor = record.status === ProcessingStatus.SUCCESS ? chalk.green :
                      record.status === ProcessingStatus.ABNORMAL ? chalk.red :
                      record.status === ProcessingStatus.MANUALLY_CORRECTED ? chalk.yellow :
                      chalk.gray;
  console.log(`  状态: ${statusColor(record.status)}`);
  console.log(`  摘要: ${record.summary}`);
  
  if (record.abnormalType) {
    console.log(chalk.red(`  异常类型: ${record.abnormalType}`));
    console.log(chalk.red(`  异常原因: ${record.abnormalReason}`));
    if (record.truncatedFields?.length) {
      console.log(chalk.red(`  截断字段: ${record.truncatedFields.join(', ')}`));
    }
  }

  if (record.status === ProcessingStatus.MANUALLY_CORRECTED) {
    console.log(chalk.yellow(`  修正人: ${record.correctedBy}`));
    console.log(chalk.yellow(`  修正原因: ${record.correctionReason}`));
    console.log(chalk.yellow(`  修正时间: ${record.correctionTime}`));
  }

  console.log(`  处理结果: ${record.processingResult || '-'}`);
  console.log(`  创建时间: ${record.createdAt}`);
  console.log(`  更新时间: ${record.updatedAt}`);
}
