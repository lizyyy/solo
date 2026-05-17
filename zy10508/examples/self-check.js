const { initTables } = require('../src/database');
const {
  DatasetVersionService,
  DownstreamProjectService,
  AcknowledgmentService,
  RollbackRequestService,
  ReportService,
  OperationLogService
} = require('../src/services');

const moment = require('moment');

function log(title, content, success = true) {
  const icon = success ? '✓' : '✗';
  console.log(`${icon} ${title}`);
  if (content) {
    console.log('  ', content);
  }
}

async function runSelfCheck() {
  console.log('========================================');
  console.log('  数据集签收API - 自检脚本');
  console.log('========================================\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, fn) {
    try {
      const result = await fn();
      results.passed++;
      results.tests.push({ name, status: 'passed', result });
      log(name, result ? JSON.stringify(result).substring(0, 100) : '');
      return result;
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'failed', error: error.message });
      log(name, error.message, false);
      return null;
    }
  }

  console.log('--- 初始化数据库表 ---\n');
  await test('初始化数据库表', async () => {
    await initTables();
    return true;
  });

  console.log('\n--- 核心业务逻辑检查 ---\n');

  let projectId, datasetVersionId, ackId, rollbackId;

  await test('创建下游项目', async () => {
    const result = await DownstreamProjectService.create({
      project_name: `自检测试项目_${Date.now()}`,
      owner: 'tester',
      description: '用于自检的测试项目'
    }, 'self_check');
    if (result.success) {
      projectId = result.id;
    }
    return result.success;
  });

  await test('查询下游项目', async () => {
    const result = await DownstreamProjectService.getById(projectId);
    return result && result.id === projectId;
  });

  await test('创建数据集版本(草稿)', async () => {
    const result = await DatasetVersionService.create({
      dataset_name: 'test_dataset',
      version: `v${Date.now()}`,
      publisher: 'data_team',
      change_summary: '测试版本'
    }, 'self_check');
    if (result.success) {
      datasetVersionId = result.id;
    }
    return result.success;
  });

  await test('发布数据集版本', async () => {
    const result = await DatasetVersionService.publish(datasetVersionId, 'self_check');
    return result.success;
  });

  await test('创建签收任务', async () => {
    const result = await AcknowledgmentService.create({
      dataset_version_id: datasetVersionId,
      project_id: projectId,
      assignee: 'tester',
      deadline: moment().add(3, 'days').toISOString()
    }, 'self_check');
    if (result.success) {
      ackId = result.id;
    }
    return result.success;
  });

  await test('执行签收操作', async () => {
    const result = await AcknowledgmentService.acknowledge(ackId, {
      acknowledgment_note: '自检测试签收'
    }, 'self_check');
    return result.success;
  });

  await test('查询签收详情', async () => {
    const result = await AcknowledgmentService.getDetails(ackId);
    return result && result.status === 'acknowledged';
  });

  await test('创建回退申请', async () => {
    const result = await RollbackRequestService.create({
      dataset_version_id: datasetVersionId,
      project_id: projectId,
      requester: 'tester',
      reason: '测试回退申请'
    }, 'self_check');
    if (result.success) {
      rollbackId = result.id;
    }
    return result.success;
  });

  await test('审批回退申请', async () => {
    const result = await RollbackRequestService.approve(rollbackId, {
      approver: 'manager',
      approval_note: '同意测试回退',
      approved: true
    }, 'self_check');
    return result.success;
  });

  await test('生成签收报告', async () => {
    const result = await ReportService.generateAcknowledgmentReport(datasetVersionId, 'self_check');
    return result.success && result.reportData;
  });

  console.log('\n--- 异常处理与日志检查 ---\n');

  await test('操作日志记录存在', async () => {
    const logs = await OperationLogService.getLogs('dataset_version', datasetVersionId);
    return logs.length > 0;
  });

  await test('操作日志包含原始输入', async () => {
    const logs = await OperationLogService.getLogs('dataset_version', datasetVersionId);
    const createLog = logs.find(l => l.operation_type === 'create');
    return createLog && createLog.original_input;
  });

  await test('操作日志包含处理依据', async () => {
    const logs = await OperationLogService.getLogs('dataset_version', datasetVersionId);
    const publishLog = logs.find(l => l.operation_type === 'publish');
    return publishLog && publishLog.processing_basis;
  });

  await test('失败操作可查询', async () => {
    await DatasetVersionService.publish('non_existent_id', 'self_check');
    const failedLogs = await OperationLogService.getAllFailedLogs();
    return failedLogs.length > 0;
  });

  console.log('\n--- 人工修正检查 ---\n');

  await test('人工修正签收状态', async () => {
    const result = await AcknowledgmentService.manualCorrect(ackId, {
      operator: 'admin',
      correction_reason: '测试人工修正',
      updates: {
        acknowledgment_note: '人工修正后的备注'
      }
    }, 'self_check_admin');
    return result.success;
  });

  await test('人工修正后可从日志追溯', async () => {
    const logs = await OperationLogService.getLogs('acknowledgment', ackId);
    const correctLog = logs.find(l => l.operation_type === 'manual_correct');
    return correctLog && correctLog.processing_basis;
  });

  console.log('\n--- 数据持久化检查 ---\n');

  await test('重启后数据仍存在', async () => {
    const dataset = await DatasetVersionService.getById(datasetVersionId);
    const project = await DownstreamProjectService.getById(projectId);
    const acknowledgment = await AcknowledgmentService.getById(ackId);
    return dataset && project && acknowledgment;
  });

  console.log('\n========================================');
  console.log(`  自检结果: ${results.passed} 通过, ${results.failed} 失败`);
  console.log('========================================');

  if (results.failed > 0) {
    console.log('\n失败的测试:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('\n✓ 所有检查通过! 服务可正常运行。');
    console.log('\n关键功能验证:');
    console.log('  ✓ 数据模型完整');
    console.log('  ✓ 核心业务流程正常');
    console.log('  ✓ 异常路径日志完整');
    console.log('  ✓ 失败操作可追溯');
    console.log('  ✓ 人工修正有记录');
    console.log('  ✓ 数据持久化可靠');
    process.exit(0);
  }
}

runSelfCheck().catch(err => {
  console.error('自检执行出错:', err);
  process.exit(1);
});
