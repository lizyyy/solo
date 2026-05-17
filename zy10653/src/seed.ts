import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { TranscodeTask, TaskStatus, FailureCode } from './entities/TranscodeTask';
import { RetryHistory, RetryType, RetryTrigger } from './entities/RetryHistory';
import { RowValidation, ValidationStatus, ValidationRule } from './entities/RowValidation';
import { TranscodeTaskService } from './services/TranscodeTaskService';

async function seed() {
  await AppDataSource.initialize();
  console.log('开始生成种子数据...');

  const taskRepository = AppDataSource.getRepository(TranscodeTask);
  const historyRepository = AppDataSource.getRepository(RetryHistory);
  const validationRepository = AppDataSource.getRepository(RowValidation);
  const service = new TranscodeTaskService();

  console.log('1. 生成完整流转任务数据...');
  const fullFlowTask = taskRepository.create({
    businessNo: 'FIN-2024-001',
    fileName: '2024年Q1财务报表.xlsx',
    fileHash: 'a1b2c3d4e5f6g7h8i9j0',
    fileSize: 2048576,
    sourceFormat: 'xlsx',
    targetFormat: 'csv',
    status: TaskStatus.COMPLETED,
    failureCode: undefined,
    failureMessage: undefined,
    retryParams: { encoding: 'UTF-8', delimiter: ',' },
    retryCount: 2,
    maxRetryCount: 3,
    sourceFilePath: '/uploads/fin-2024-001.xlsx',
    outputFilePath: '/outputs/fin-2024-001.csv',
    isManuallyRetried: true,
    lastRetriedBy: 'zhangsan@company.com',
    lastRetriedAt: new Date('2024-03-15T10:30:00'),
    createdBy: 'lisi@company.com',
    createdAt: new Date('2024-03-15T09:00:00'),
    updatedAt: new Date('2024-03-15T11:00:00'),
  });
  const savedFullFlowTask = await taskRepository.save(fullFlowTask);

  const history1 = historyRepository.create({
    taskId: savedFullFlowTask.id,
    retryType: RetryType.AUTO,
    retryTrigger: RetryTrigger.SCHEDULED_JOB,
    statusBefore: TaskStatus.PENDING,
    statusAfter: TaskStatus.PROCESSING,
    retryAttemptNumber: 0,
    createdAt: new Date('2024-03-15T09:00:05'),
  });
  await historyRepository.save(history1);

  const history2 = historyRepository.create({
    taskId: savedFullFlowTask.id,
    retryType: RetryType.AUTO,
    retryTrigger: RetryTrigger.SCHEDULED_JOB,
    statusBefore: TaskStatus.PROCESSING,
    statusAfter: TaskStatus.FAILED,
    previousFailureCode: FailureCode.NETWORK_ERROR,
    previousFailureMessage: '连接文件服务器超时，重试1/3',
    finalStatus: TaskStatus.FAILED,
    finalFailureCode: FailureCode.NETWORK_ERROR,
    finalFailureMessage: '连接文件服务器超时，重试1/3',
    retryAttemptNumber: 1,
    createdAt: new Date('2024-03-15T09:05:00'),
    completedAt: new Date('2024-03-15T09:05:00'),
  });
  await historyRepository.save(history2);

  const history3 = historyRepository.create({
    taskId: savedFullFlowTask.id,
    retryType: RetryType.MANUAL,
    retryTrigger: RetryTrigger.USER_CLICK,
    statusBefore: TaskStatus.FAILED,
    statusAfter: TaskStatus.RETRYING,
    previousFailureCode: FailureCode.NETWORK_ERROR,
    previousFailureMessage: '连接文件服务器超时，重试1/3',
    retriedBy: 'zhangsan@company.com',
    retryNote: '网络已恢复，人工重试',
    fileHashBefore: 'a1b2c3d4e5f6g7h8i9j0',
    fileHashAfter: 'a1b2c3d4e5f6g7h8i9j0',
    isHashChanged: false,
    retryAttemptNumber: 1,
    createdAt: new Date('2024-03-15T10:00:00'),
    finalStatus: TaskStatus.RETRYING,
  });
  await historyRepository.save(history3);

  const history4 = historyRepository.create({
    taskId: savedFullFlowTask.id,
    retryType: RetryType.MANUAL,
    retryTrigger: RetryTrigger.USER_CLICK,
    statusBefore: TaskStatus.RETRYING,
    statusAfter: TaskStatus.COMPLETED,
    previousFailureCode: FailureCode.NETWORK_ERROR,
    previousFailureMessage: '连接文件服务器超时，重试1/3',
    retriedBy: 'zhangsan@company.com',
    retryNote: '转码完成',
    retryAttemptNumber: 2,
    createdAt: new Date('2024-03-15T10:30:00'),
    completedAt: new Date('2024-03-15T11:00:00'),
    finalStatus: TaskStatus.COMPLETED,
  });
  await historyRepository.save(history4);

  console.log('2. 生成源文件替换冲突任务数据...');
  const conflictTask = taskRepository.create({
    businessNo: 'HR-2024-002',
    fileName: '3月员工考勤数据.xlsx',
    fileHash: 'x9y8z7w6v5u4t3s2r1q0',
    fileSize: 1048576,
    sourceFormat: 'xlsx',
    targetFormat: 'json',
    status: TaskStatus.CONFLICT,
    failureCode: FailureCode.ROW_VALIDATION_FAILED,
    failureMessage: '第15行：员工ID格式错误，应为8位数字',
    retryParams: { includeHeader: true, sheetName: 'Sheet1' },
    retryCount: 1,
    maxRetryCount: 3,
    sourceFilePath: '/uploads/hr-2024-002-v1.xlsx',
    isManuallyRetried: true,
    lastRetriedBy: 'wangwu@company.com',
    lastRetriedAt: new Date('2024-03-16T14:20:00'),
    createdBy: 'zhaoliu@company.com',
    createdAt: new Date('2024-03-16T14:00:00'),
    updatedAt: new Date('2024-03-16T15:00:00'),
    conflictNote: '检测到源文件已被用户替换，旧文件哈希: x9y8z7w6v5u4t3s2r1q0，新文件哈希: k1j2h3g4f5e6d7c8b9a0',
  });
  const savedConflictTask = await taskRepository.save(conflictTask);

  const conflictHistory1 = historyRepository.create({
    taskId: savedConflictTask.id,
    retryType: RetryType.AUTO,
    retryTrigger: RetryTrigger.SCHEDULED_JOB,
    statusBefore: TaskStatus.PENDING,
    statusAfter: TaskStatus.FAILED,
    previousFailureCode: FailureCode.ROW_VALIDATION_FAILED,
    previousFailureMessage: '第15行：员工ID格式错误，应为8位数字',
    finalStatus: TaskStatus.FAILED,
    finalFailureCode: FailureCode.ROW_VALIDATION_FAILED,
    finalFailureMessage: '第15行：员工ID格式错误，应为8位数字',
    retryAttemptNumber: 1,
    createdAt: new Date('2024-03-16T14:05:00'),
    completedAt: new Date('2024-03-16T14:05:00'),
  });
  await historyRepository.save(conflictHistory1);

  const conflictHistory2 = historyRepository.create({
    taskId: savedConflictTask.id,
    retryType: RetryType.MANUAL,
    retryTrigger: RetryTrigger.USER_CLICK,
    statusBefore: TaskStatus.FAILED,
    statusAfter: TaskStatus.RETRYING,
    previousFailureCode: FailureCode.ROW_VALIDATION_FAILED,
    previousFailureMessage: '第15行：员工ID格式错误，应为8位数字',
    retriedBy: 'wangwu@company.com',
    retryNote: '已修正第15行数据，重新转码',
    retryAttemptNumber: 1,
    createdAt: new Date('2024-03-16T14:20:00'),
  });
  await historyRepository.save(conflictHistory2);

  const conflictHistory3 = historyRepository.create({
    taskId: savedConflictTask.id,
    retryType: RetryType.CALLBACK,
    retryTrigger: RetryTrigger.API_CALL,
    statusBefore: TaskStatus.FAILED,
    statusAfter: TaskStatus.CONFLICT,
    fileHashBefore: 'x9y8z7w6v5u4t3s2r1q0',
    fileHashAfter: 'k1j2h3g4f5e6d7c8b9a0',
    isHashChanged: true,
    isCallbackOverride: true,
    sourceFileReplaced: true,
    retryNote: '转码服务回调检测到源文件哈希不一致，用户已上传了新版本文件',
    retryAttemptNumber: 2,
    createdAt: new Date('2024-03-16T14:45:00'),
  });
  await historyRepository.save(conflictHistory3);

  console.log('3. 生成导入坏行任务数据...');
  const badRowsTask = taskRepository.create({
    businessNo: 'SALE-2024-003',
    fileName: '3月销售订单导入.csv',
    fileHash: 'm1n2b3v4c5x6z7a8s9d0',
    fileSize: 524288,
    sourceFormat: 'csv',
    targetFormat: 'db',
    status: TaskStatus.FAILED,
    failureCode: FailureCode.ROW_VALIDATION_FAILED,
    failureMessage: '共发现3条坏行，需人工处理后重试',
    retryParams: { batchSize: 1000, skipErrors: false },
    retryCount: 0,
    maxRetryCount: 3,
    sourceFilePath: '/uploads/sale-2024-003.csv',
    isManuallyRetried: false,
    createdBy: 'sunqi@company.com',
    createdAt: new Date('2024-03-17T09:30:00'),
    updatedAt: new Date('2024-03-17T09:35:00'),
  });
  const savedBadRowsTask = await taskRepository.save(badRowsTask);

  const badRow1 = validationRepository.create({
    taskId: savedBadRowsTask.id,
    rowNumber: 5,
    sheetName: undefined,
    rowData: {
      orderNo: 'ORD-2024-03-0005',
      customerId: '',
      amount: '1500.50',
      orderDate: '2024-03-01',
      status: 'completed',
    },
    status: ValidationStatus.FAILED,
    validationErrors: [
      {
        field: 'customerId',
        rule: ValidationRule.REQUIRED,
        message: '客户ID不能为空',
        severity: 'error',
      },
    ],
    isBadRow: true,
    isImported: false,
    createdAt: new Date('2024-03-17T09:32:00'),
    validatedAt: new Date('2024-03-17T09:32:00'),
  });
  await validationRepository.save(badRow1);

  const badRow2 = validationRepository.create({
    taskId: savedBadRowsTask.id,
    rowNumber: 12,
    sheetName: undefined,
    rowData: {
      orderNo: 'ORD-2024-03-0012',
      customerId: 'CUST-0012',
      amount: 'abc',
      orderDate: '2024-03-05',
      status: 'pending',
    },
    status: ValidationStatus.FAILED,
    validationErrors: [
      {
        field: 'amount',
        rule: ValidationRule.DATA_TYPE,
        message: '金额必须是有效数字',
        actual: 'abc',
        severity: 'error',
      },
    ],
    isBadRow: true,
    isImported: false,
    createdAt: new Date('2024-03-17T09:32:05'),
    validatedAt: new Date('2024-03-17T09:32:05'),
  });
  await validationRepository.save(badRow2);

  const badRow3 = validationRepository.create({
    taskId: savedBadRowsTask.id,
    rowNumber: 28,
    sheetName: undefined,
    rowData: {
      orderNo: 'ORD-2024-03-0028',
      customerId: 'CUST-0028',
      amount: '-500.00',
      orderDate: '2024-03-10',
      status: 'refunded',
    },
    status: ValidationStatus.FAILED,
    validationErrors: [
      {
        field: 'amount',
        rule: ValidationRule.RANGE,
        message: '金额必须大于0',
        expected: '> 0',
        actual: '-500.00',
        severity: 'error',
      },
    ],
    isBadRow: true,
    isImported: false,
    createdAt: new Date('2024-03-17T09:32:10'),
    validatedAt: new Date('2024-03-17T09:32:10'),
  });
  await validationRepository.save(badRow3);

  const goodRow = validationRepository.create({
    taskId: savedBadRowsTask.id,
    rowNumber: 1,
    sheetName: undefined,
    rowData: {
      orderNo: 'ORD-2024-03-0001',
      customerId: 'CUST-0001',
      amount: '2500.00',
      orderDate: '2024-03-01',
      status: 'completed',
    },
    status: ValidationStatus.PASSED,
    validationErrors: [],
    isBadRow: false,
    isImported: true,
    createdAt: new Date('2024-03-17T09:31:00'),
    validatedAt: new Date('2024-03-17T09:31:00'),
  });
  await validationRepository.save(goodRow);

  console.log('4. 生成重复重试防重点击测试任务...');
  const duplicateClickTask = taskRepository.create({
    businessNo: 'INV-2024-004',
    fileName: '3月发票数据.xml',
    fileHash: 'p1o2i3u4y5t6r7e8w9q0',
    fileSize: 3145728,
    sourceFormat: 'xml',
    targetFormat: 'pdf',
    status: TaskStatus.RETRYING,
    failureCode: FailureCode.INVALID_ENCODING,
    failureMessage: 'XML文件编码格式错误，应为UTF-8',
    retryCount: 1,
    maxRetryCount: 3,
    sourceFilePath: '/uploads/inv-2024-004.xml',
    isManuallyRetried: true,
    lastRetriedBy: 'zhouba@company.com',
    lastRetriedAt: new Date('2024-03-18T11:05:00'),
    createdBy: 'zhouba@company.com',
    createdAt: new Date('2024-03-18T11:00:00'),
    updatedAt: new Date('2024-03-18T11:05:00'),
  });
  const savedDuplicateTask = await taskRepository.save(duplicateClickTask);

  const duplicateHistory = historyRepository.create({
    taskId: savedDuplicateTask.id,
    retryType: RetryType.MANUAL,
    retryTrigger: RetryTrigger.USER_CLICK,
    statusBefore: TaskStatus.FAILED,
    statusAfter: TaskStatus.RETRYING,
    previousFailureCode: FailureCode.INVALID_ENCODING,
    previousFailureMessage: 'XML文件编码格式错误，应为UTF-8',
    retriedBy: 'zhouba@company.com',
    retryNote: '已重新上传正确编码的文件',
    requestId: 'req-20240318-001',
    retryAttemptNumber: 1,
    createdAt: new Date('2024-03-18T11:05:00'),
  });
  await historyRepository.save(duplicateHistory);

  console.log('\n种子数据生成完成！');
  console.log('\n数据概览:');
  console.log('- 转码任务总数: 4');
  console.log('- 重试历史记录: 8');
  console.log('- 行级校验记录: 4');

  console.log('\n验收场景:');
  console.log('1. 完整流转: FIN-2024-001 - 从创建→失败→人工重试→完成');
  console.log('2. 冲突记录: HR-2024-002 - 源文件替换后冲突检测');
  console.log('3. 导入坏行: SALE-2024-003 - 3条校验失败的坏行');
  console.log('4. 防重点击: INV-2024-004 - 带requestId的重复请求检测');

  await AppDataSource.destroy();
  process.exit(0);
}

seed().catch((error) => {
  console.error('种子数据生成失败:', error);
  process.exit(1);
});
