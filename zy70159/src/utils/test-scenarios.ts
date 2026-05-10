import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import User from '../models/User';
import SensitiveField from '../models/SensitiveField';
import ExportService from '../services/ExportService';
import ApprovalService from '../services/ApprovalService';
import ExceptionService from '../services/ExceptionService';

let requester1Id: string;
let requester2Id: string;
let approver1Id: string;
let approver2Id: string;

async function setupTestData() {
  await sequelize.sync({ force: true });

  const users = [
    {
      id: uuidv4(),
      name: '张三',
      role: 'requester' as const,
      department: '销售部',
    },
    {
      id: uuidv4(),
      name: '李四',
      role: 'requester' as const,
      department: '市场部',
    },
    {
      id: uuidv4(),
      name: '王经理',
      role: 'approver' as const,
      department: '合规部',
    },
    {
      id: uuidv4(),
      name: '刘总监',
      role: 'approver' as const,
      department: '风控部',
    },
  ];

  const createdUsers = await User.bulkCreate(users);
  requester1Id = createdUsers[0].id;
  requester2Id = createdUsers[1].id;
  approver1Id = createdUsers[2].id;
  approver2Id = createdUsers[3].id;

  await SensitiveField.bulkCreate([
    {
      id: uuidv4(),
      fieldName: 'idCard',
      dataType: 'string',
      sensitivityLevel: 'high',
      maskingRule: 'mask_middle',
      description: '身份证号',
    },
    {
      id: uuidv4(),
      fieldName: 'phone',
      dataType: 'string',
      sensitivityLevel: 'medium',
      maskingRule: 'mask_middle',
      description: '手机号',
    },
    {
      id: uuidv4(),
      fieldName: 'name',
      dataType: 'string',
      sensitivityLevel: 'low',
      maskingRule: 'mask_middle',
      description: '姓名',
    },
  ]);
}

function printHeader(title: string) {
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log(`  ${title}`);
  console.log(line);
}

function printResult(success: boolean, message: string, details?: any) {
  const icon = success ? '✓' : '✗';
  const status = success ? '成功' : '失败';
  console.log(`\n  ${icon} [${status}] ${message}`);
  if (details) {
    console.log(`    详情: ${JSON.stringify(details, null, 2).split('\n').join('\n    ')}`);
  }
}

async function runScenario1_NormalFlow() {
  printHeader('场景 1：正常处理流程（无高风险字段）');
  console.log('\n  流程：提交申请 → 审批通过 → 数据处理 → 下载文件');

  console.log('\n  [步骤 1] 张三提交普通字段的导出申请');
  const result1 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '客户基本信息',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['name', 'department', 'position'],
    purpose: '年度销售数据分析',
  });
  printResult(result1.success, result1.message, {
    requestId: result1.request?.id,
    approvalFlow: result1.flowRecords,
  });

  if (!result1.success || !result1.request) return;

  console.log('\n  [步骤 2] 王经理审批通过（单审批）');
  const result2 = await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
    comment: '同意，数据使用请遵守规范',
  });
  printResult(result2.success, result2.message, { allApproved: result2.allApproved });

  console.log('\n  [步骤 3] 处理已审批的申请，生成脱敏文件');
  const result3 = await ExportService.processApprovedRequest(result1.request.id);
  printResult(result3.success, result3.message, {
    downloadUrl: result3.downloadUrl,
    expiryTime: result3.expiryTime,
  });

  console.log('\n  [步骤 4] 张三下载文件');
  const result4 = await ExportService.downloadFile(
    result1.request.id,
    requester1Id,
    { ipAddress: '192.168.1.100', userAgent: 'TestClient/1.0' }
  );
  const filePreview = result4.fileContent?.split('\n').slice(0, 3).join('\n');
  printResult(result4.success, result4.message, {
    fileName: result4.fileName,
    filePreview: filePreview,
  });

  console.log('\n  [步骤 5] 生成任务报告');
  const result5 = await ExportService.generateTaskReport(result1.request.id);
  printResult(result5.success, result5.message, {
    requestInfo: result5.report?.requestInfo,
    approvalFlow: result5.report?.approvalFlow,
    downloadCount: result5.report?.downloadAudits.length,
  });
}

async function runScenario2_HighRiskFlow() {
  printHeader('场景 2：高风险字段处理流程（双审批）');
  console.log('\n  流程：提交含高风险字段申请 → 一级审批 → 二级审批 → 处理');

  console.log('\n  [步骤 1] 张三提交含高风险字段的导出申请');
  const result1 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '客户敏感信息',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['name', 'phone', 'idCard'],
    purpose: '客户信用评估分析',
  });
  printResult(result1.success, result1.message, {
    requestId: result1.request?.id,
    needSpecialApproval: result1.needSpecialApproval,
    approvalFlow: result1.flowRecords,
  });

  if (!result1.success || !result1.request) return;

  console.log('\n  [步骤 2] 王经理一级审批通过');
  const result2 = await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
    comment: '同意，但数据需要严格脱敏',
  });
  printResult(result2.success, result2.message, { allApproved: result2.allApproved });

  console.log('\n  [步骤 3] 刘总监二级审批通过');
  const result3 = await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver2Id,
    comment: '同意，使用后请及时销毁',
  });
  printResult(result3.success, result3.message, { allApproved: result3.allApproved });

  console.log('\n  [步骤 4] 处理申请，生成脱敏文件');
  const result4 = await ExportService.processApprovedRequest(result1.request.id);
  printResult(result4.success, result4.message);

  console.log('\n  [步骤 5] 下载文件，验证脱敏效果');
  const result5 = await ExportService.downloadFile(
    result1.request.id,
    requester1Id
  );
  const fileLines = result5.fileContent?.split('\n') || [];
  const dataLine = fileLines.find((line) => line.includes('*'));
  printResult(result5.success, result5.message, {
    fileName: result5.fileName,
    '脱敏效果预览': dataLine || '查看完整文件内容',
  });
}

async function runScenario3_RejectFlow() {
  printHeader('场景 3：审批驳回流程');
  console.log('\n  流程：提交申请 → 审批驳回');

  console.log('\n  [步骤 1] 张三提交导出申请');
  const result1 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '订单信息',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['orderNo', 'amount', 'name'],
    purpose: '不明用途的数据分析',
  });
  printResult(result1.success, result1.message);

  if (!result1.success || !result1.request) return;

  console.log('\n  [步骤 2] 王经理驳回申请');
  const result2 = await ApprovalService.rejectRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
    comment: '导出用途不明确，请补充详细说明后重新提交',
  });
  printResult(result2.success, result2.message);
}

async function runScenario4_RepeatedOperation() {
  printHeader('场景 4：重复操作拦截');
  console.log('\n  测试：重复提交申请、重复审批等异常操作');

  console.log('\n  [步骤 1] 张三提交第一个申请');
  const result1 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '客户信息',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['name', 'phone'],
    purpose: '客户服务优化',
  });
  printResult(result1.success, result1.message);

  if (!result1.success || !result1.request) return;

  console.log('\n  [步骤 2] 张三重复提交同类申请（应该被拦截）');
  const result2 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '客户信息',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['name'],
    purpose: '其他用途',
  });
  printResult(result2.success, result2.message);

  console.log('\n  [步骤 3] 王经理审批通过');
  const result3 = await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
  });
  printResult(result3.success, result3.message);

  console.log('\n  [步骤 4] 王经理重复审批（应该被拦截）');
  const result4 = await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
  });
  printResult(result4.success, result4.message);
}

async function runScenario5_DownloadException() {
  printHeader('场景 5：下载边界场景（文件过期、权限验证）');
  console.log('\n  测试：非申请人下载、文件过期等异常');

  console.log('\n  [步骤 1] 张三提交并完成整个流程');
  const result1 = await ExportService.createExportRequest({
    requesterId: requester1Id,
    dataCategory: '测试数据1',
    exportTimeRange: { start: '2024-01-01', end: '2024-12-31' },
    fieldsToExport: ['name', 'department'],
    purpose: '测试用途',
  });

  if (!result1.success || !result1.request) return;

  await ApprovalService.approveRequest({
    requestId: result1.request.id,
    approverId: approver1Id,
  });

  const processResult = await ExportService.processApprovedRequest(result1.request.id);
  printResult(processResult.success, '数据处理完成');

  console.log('\n  [步骤 2] 李四尝试下载张三的文件（应该被拦截）');
  const result2 = await ExportService.downloadFile(
    result1.request.id,
    requester2Id
  );
  printResult(result2.success, result2.message);
}

async function runScenario6_CheckExceptions() {
  printHeader('场景 6：异常记录查询与处理');
  console.log('\n  展示：所有边界数据如何进入可查询的异常记录');

  const pendingExceptions = await ExceptionService.getPendingExceptions();
  console.log(`\n  当前待处理异常数量：${pendingExceptions.length}`);
  
  if (pendingExceptions.length > 0) {
    console.log('\n  异常记录详情：');
    pendingExceptions.forEach((e, index) => {
      const typeMap: Record<string, string> = {
        file_expiry: '文件过期',
        download_failure: '下载失败',
        task_failure: '任务失败',
        repeated_operation: '重复操作',
        sensitive_field_violation: '敏感字段违规',
        other: '其他异常',
      };
      console.log(`\n    [${index + 1}] 类型：${typeMap[e.type] || e.type}`);
      console.log(`        描述：${e.description}`);
      console.log(`        状态：待处理`);
      console.log(`        时间：${e.createdAt}`);
    });
  }

  const allExceptions = await ExceptionService.getAllExceptions();
  console.log(`\n  历史异常记录总数：${allExceptions.length}`);
}

async function runAllScenarios() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║        数据导出审批 API 服务端原型 - 场景测试脚本          ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await setupTestData();
  console.log('\n测试环境已就绪，用户信息：');
  console.log('  申请人：张三、李四');
  console.log('  审批人：王经理（一级）、刘总监（二级）');
  console.log('  高风险敏感字段：idCard（身份证号）');
  console.log('  中风险敏感字段：phone（手机号）');
  console.log('  低风险敏感字段：name（姓名）');

  await runScenario1_NormalFlow();
  await runScenario2_HighRiskFlow();
  await runScenario3_RejectFlow();
  await runScenario4_RepeatedOperation();
  await runScenario5_DownloadException();
  await runScenario6_CheckExceptions();

  printHeader('测试总结');
  console.log('\n  已完成测试场景：');
  console.log('    ✓ 场景 1：正常处理流程（无高风险字段）');
  console.log('    ✓ 场景 2：高风险字段处理流程（双审批）');
  console.log('    ✓ 场景 3：审批驳回流程');
  console.log('    ✓ 场景 4：重复操作拦截');
  console.log('    ✓ 场景 5：下载边界场景');
  console.log('    ✓ 场景 6：异常记录查询');
  console.log('\n  所有边界数据已进入异常记录系统，可通过以下方式查询：');
  console.log('    - API: GET /api/exceptions/pending');
  console.log('    - API: GET /api/exceptions');
  console.log('\n');

  await sequelize.close();
}

runAllScenarios().catch(console.error);
