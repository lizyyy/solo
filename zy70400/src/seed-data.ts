import chalk from 'chalk';
import { Storage } from './storage';
import { ProcessingStatus, AbnormalType } from './types';

console.log(chalk.blue.bold('正在生成测试数据...\n'));

const batchId = 'AFS-2024-0515';

Storage.addBatch({
  batchId,
  batchName: '跨天售后录音归档',
  source: '客服系统-售后录音转写',
  processingBasis: '售后质量检测标准V2.0',
  totalRecords: 0,
  successCount: 0,
  abnormalCount: 0,
  pendingCount: 0,
  correctedCount: 0
});

console.log(chalk.white('已创建批次:', chalk.bold(batchId)));

const records = [
  {
    batchId,
    recordingId: 'REC-20240514-234501',
    customerName: '张三',
    phoneNumber: '138****1234',
    serviceType: '退货退款',
    startTime: '2024-05-14 23:45:00',
    endTime: '2024-05-14 23:58:30',
    duration: 810,
    agentName: '王芳',
    summary: '客户反馈商品质量问题，要求退货退款，已同意申请并发送退货地址',
    status: ProcessingStatus.SUCCESS,
    processingResult: '处理完成，无异常',
  },
  {
    batchId,
    recordingId: 'REC-20240514-235902',
    customerName: '李四',
    phoneNumber: '139****5678',
    serviceType: '换货',
    startTime: '2024-05-14 23:59:00',
    endTime: '2024-05-15 00:15:20',
    duration: 980,
    agentName: '赵敏',
    summary: '跨天通话记录，客户咨询换货流程',
    status: ProcessingStatus.PENDING,
  },
  {
    batchId,
    recordingId: 'REC-20240515-002003',
    customerName: '王五...',
    phoneNumber: '137****9012',
    serviceType: '投诉',
    startTime: '2024-05-15 00:20:00',
    endTime: '2024-05-15 00:45:30',
    duration: 1530,
    agentName: '刘强',
    summary: '截',
    status: ProcessingStatus.ABNORMAL,
    abnormalType: AbnormalType.FIELD_TRUNCATED,
    abnormalReason: '检测到字段截断，需要人工复核',
    isFieldTruncated: true,
    truncatedFields: ['customerName', 'summary'],
  },
  {
    batchId,
    recordingId: 'REC-20240515-093004',
    customerName: '赵六',
    phoneNumber: '136****3456',
    serviceType: '咨询',
    startTime: '2024-05-15 09:30:00',
    endTime: '2024-05-15 09:42:15',
    duration: 735,
    agentName: '孙丽',
    summary: '客户咨询保修政策，详细解答了保修期限和范围',
    status: ProcessingStatus.PENDING,
  },
  {
    batchId,
    recordingId: 'REC-20240515-140005',
    customerName: '钱七',
    phoneNumber: '135****7890',
    serviceType: '退款',
    startTime: '2024-05-15 14:00:00',
    endTime: '2024-05-15 14:18:45',
    duration: 1125,
    agentName: '周杰',
    summary: '客户申请退款，核实订单状态，已处理完成',
    status: ProcessingStatus.PENDING,
  },
  {
    batchId,
    recordingId: 'REC-20240515-163006',
    customerName: '孙...',
    phoneNumber: '134****5555',
    serviceType: '售后',
    startTime: '2024-05-15 16:30:00',
    endTime: '2024-05-15 16:45:00',
    duration: 900,
    agentName: '吴磊',
    summary: '客户反馈收',
    status: ProcessingStatus.MANUALLY_CORRECTED,
    abnormalType: AbnormalType.FIELD_TRUNCATED,
    abnormalReason: '检测到字段截断，需要人工复核',
    isFieldTruncated: true,
    truncatedFields: ['customerName', 'summary'],
    correctedBy: '质检主管',
    correctionReason: '字段截断已补全，客户反馈收到商品有破损，已安排补发',
    correctionTime: new Date().toISOString(),
  },
];

records.forEach((record, index) => {
  const saved = Storage.addRecord(record);
  console.log(chalk.green(`  ✓ 已创建记录 ${index + 1}: ${record.recordingId}`));
});

console.log(chalk.blue.bold('\n测试数据生成完成!\n'));
console.log(chalk.white('批次号:', chalk.bold(batchId)));
console.log(chalk.white('总记录数:', records.length));
console.log(chalk.white('包含:'));
console.log(chalk.green('  - 1条成功处理记录'));
console.log(chalk.gray('  - 3条待处理记录'));
console.log(chalk.red('  - 1条字段截断异常记录 (abnormal状态)'));
console.log(chalk.yellow('  - 1条人工修正记录 (保留异常类型)'));
console.log(chalk.cyan('\n使用以下命令验证:'));
console.log(chalk.cyan('  npm run dev -- query                    # 查看所有记录'));
console.log(chalk.cyan('  npm run dev -- query --status abnormal   # 仅看异常记录'));
console.log(chalk.cyan('  npm run dev -- export --abnormal-only    # 仅导出异常记录'));
