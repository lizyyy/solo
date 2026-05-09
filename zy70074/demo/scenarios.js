const { initSampleData, storage } = require('../src/data/store');
const assetService = require('../src/services/assetService');
const transferService = require('../src/services/transferService');
const reportService = require('../src/services/reportService');
const taskService = require('../src/services/taskService');
const { createError, ErrorCodes: EC } = require('../src/services/errors');

function printHeader(title) {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}`);
}

function printSubHeader(title) {
  console.log(`\n  --- ${title} ---`);
}

function printSuccess(message, data = null) {
  console.log(`  ✅ ${message}`);
  if (data) {
    console.log(`     数据: ${JSON.stringify(data, null, 2).split('\n').join('\n     ')}`);
  }
}

function printError(error) {
  console.log(`  ❌ 业务错误`);
  console.log(`     错误码: ${error.code}`);
  console.log(`     错误信息: ${error.message}`);
  if (error.details) {
    console.log(`     详细信息: ${JSON.stringify(error.details, null, 2).split('\n').join('\n                 ')}`);
  }
}

function printSeparator() {
  console.log('  -'.repeat(30));
}

async function runScenarios() {
  console.clear();
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          办公资产调拨 API 系统 - 业务场景演示              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  initSampleData();
  console.log('\n  已初始化样例数据: 4 个资产, 1 条盘点记录, 2 个折旧配置');

  printHeader('场景一: 正常调拨流程（跨部门资产调拨）');
  
  printSubHeader('1. 查看初始资产信息');
  const asset001 = assetService.getAssetById('asset-001');
  printSuccess('资产 asset-001 初始信息', {
    assetNo: asset001.assetNo,
    responsiblePerson: asset001.responsiblePerson,
    department: asset001.department,
    depreciationDepartment: asset001.depreciationDepartment,
    status: asset001.status
  });

  printSubHeader('2. 创建调拨单（研发部 → 市场部）');
  const transfer1 = transferService.createTransfer({
    assetId: 'asset-001',
    incomingResponsiblePerson: '赵六',
    incomingResponsiblePersonId: 'emp-zhaoliu',
    incomingDepartment: '市场部',
    incomingDepreciationDepartment: '市场部',
    transferReason: '赵六新入职，需要笔记本电脑',
    createdBy: 'emp-zhangsan'
  });
  printSuccess('调拨单创建成功', {
    transferId: transfer1.id,
    status: transfer1.status,
    statusName: transferService.getTransferStatusDisplayName(transfer1.status),
    out: `${transfer1.outgoingDepartment}(${transfer1.outgoingResponsiblePerson})`,
    in: `${transfer1.incomingDepartment}(${transfer1.incomingResponsiblePerson})`
  });

  printSubHeader('3. 提交审批');
  const submitted = transferService.submitForApproval(transfer1.id, 'emp-zhangsan');
  printSuccess('提交审批成功', {
    status: submitted.status,
    statusName: transferService.getTransferStatusDisplayName(submitted.status)
  });

  printSubHeader('4. 审批通过（注意：不能是调出人自己审批）');
  try {
    transferService.approve(transfer1.id, 'emp-zhangsan', '同意');
  } catch (e) {
    printError(e);
  }
  
  const approved = transferService.approve(transfer1.id, 'emp-admin', '设备完好，同意调拨');
  printSuccess('审批通过（管理员审批）', {
    status: approved.status,
    approvedBy: approved.approvedBy,
    approvalRemark: approved.approvalRemark
  });

  printSubHeader('5. 完成调拨（自动更新责任人和折旧部门）');
  const completed = transferService.complete(transfer1.id, 'emp-zhaoliu', '确认接收资产');
  printSuccess('调拨完成', {
    status: completed.status,
    completedBy: completed.completedBy
  });

  printSubHeader('6. 验证资产信息已更新');
  const updatedAsset = assetService.getAssetById('asset-001');
  printSuccess('资产信息已更新', {
    assetNo: updatedAsset.assetNo,
    responsiblePerson: updatedAsset.responsiblePerson,
    department: updatedAsset.department,
    depreciationDepartment: updatedAsset.depreciationDepartment,
    status: updatedAsset.status
  });

  printSubHeader('7. 查看调拨审批历史');
  const history = transferService.getApprovalHistory(transfer1.id);
  printSuccess('审批历史记录', history.map(h => ({
    action: h.action,
    operator: h.operator,
    remark: h.remark,
    time: h.createdAt
  })));

  printSeparator();
  printSuccess('场景一完成: 资产从研发部张三调拨到市场部赵六，责任人和折旧部门已自动更新');

  printHeader('场景二: 异常拦截（非法状态流转）');
  
  printSubHeader('1. 查看已完成的调拨单状态');
  printSuccess('已完成调拨单状态', {
    status: completed.status,
    statusName: transferService.getTransferStatusDisplayName(completed.status)
  });

  printSubHeader('2. 尝试对已完成的调拨单再次审批');
  try {
    transferService.approve(transfer1.id, 'emp-admin', '再次审批');
  } catch (e) {
    printError(e);
  }

  printSubHeader('3. 查看审批历史（无重复记录）');
  const history2 = transferService.getApprovalHistory(transfer1.id);
  printSuccess('审批历史仍然只有 5 条', { count: history2.length });

  printSeparator();
  printSuccess('场景二完成: 已完成状态不允许再次审批，非法流转被拦截');

  printHeader('场景三: 重复提交防护（同一资产不能重复调拨）');
  
  printSubHeader('1. 尝试为已调拨完成的资产创建新调拨单（应该成功，因为已完成）');
  const transfer2 = transferService.createTransfer({
    assetId: 'asset-001',
    incomingResponsiblePerson: '钱七',
    incomingResponsiblePersonId: 'emp-qianqi',
    incomingDepartment: '财务部',
    incomingDepreciationDepartment: '财务部',
    transferReason: '新的调拨',
    createdBy: 'emp-zhaoliu'
  });
  printSuccess('为已完成调拨的资产创建新调拨单成功', {
    transferId: transfer2.id,
    status: transfer2.status
  });

  printSubHeader('2. 提交新调拨单到待审批状态');
  transferService.submitForApproval(transfer2.id, 'emp-zhaoliu');
  printSuccess('新调拨单已提交审批');

  printSubHeader('3. 尝试为同一资产创建第三个调拨单（应该失败，因为有进行中的调拨）');
  try {
    transferService.createTransfer({
      assetId: 'asset-001',
      incomingResponsiblePerson: '孙八',
      incomingResponsiblePersonId: 'emp-sunba',
      incomingDepartment: '产品部',
      transferReason: '重复调拨测试',
      createdBy: 'emp-sunba'
    });
  } catch (e) {
    printError(e);
  }

  printSubHeader('4. 取消第二个调拨单');
  transferService.cancel(transfer2.id, 'emp-zhaoliu', '测试取消');
  printSuccess('第二个调拨单已取消');

  printSubHeader('5. 再次创建第三个调拨单（应该成功，因为已取消）');
  const transfer3 = transferService.createTransfer({
    assetId: 'asset-001',
    incomingResponsiblePerson: '孙八',
    incomingResponsiblePersonId: 'emp-sunba',
    incomingDepartment: '产品部',
    transferReason: '正常调拨',
    createdBy: 'emp-zhaoliu'
  });
  printSuccess('第三个调拨单创建成功', {
    transferId: transfer3.id,
    status: transfer3.status
  });
  
  transferService.cancel(transfer3.id, 'emp-zhaoliu', '清理测试数据');

  printSeparator();
  printSuccess('场景三完成: 同一资产不能有多个进行中的调拨单，重复提交被拦截');

  printHeader('场景四: 盘点差异拦截（盘亏资产不能调拨）');
  
  printSubHeader('1. 查看盘亏资产信息');
  const asset003 = assetService.getAssetById('asset-003');
  printSuccess('资产 asset-003 信息', {
    assetNo: asset003.assetNo,
    inventoryStatus: asset003.inventoryStatus,
    lastInventoryDate: asset003.lastInventoryDate
  });

  printSubHeader('2. 尝试为盘亏资产创建调拨单');
  try {
    transferService.createTransfer({
      assetId: 'asset-003',
      incomingResponsiblePerson: '周九',
      incomingResponsiblePersonId: 'emp-zhoujiu',
      incomingDepartment: '产品部',
      transferReason: '尝试调拨盘亏资产',
      createdBy: 'emp-lisi'
    });
  } catch (e) {
    printError(e);
  }

  printSeparator();
  printSuccess('场景四完成: 盘亏资产不允许调拨，需先处理盘点差异');

  printHeader('场景五: 折旧报表（调拨影响折旧部门）');
  
  printSubHeader('1. 查看调拨前的折旧报表');
  const reportBefore = reportService.getComprehensiveReport();
  printSuccess('折旧报表 - 按折旧部门汇总', reportBefore.depreciationSummary.byDepartment.map(d => ({
    department: d.department,
    assetCount: d.assetCount,
    netBookValue: d.netBookValue,
    monthlyDepreciation: d.monthlyDepreciation
  })));

  printSubHeader('2. 调拨 asset-002（显示器）从研发部到财务部');
  const transfer4 = transferService.createTransfer({
    assetId: 'asset-002',
    incomingResponsiblePerson: '周九',
    incomingResponsiblePersonId: 'emp-zhoujiu',
    incomingDepartment: '财务部',
    incomingDepreciationDepartment: '财务部',
    transferReason: '财务部需要额外显示器',
    createdBy: 'emp-zhangsan'
  });
  transferService.submitForApproval(transfer4.id, 'emp-zhangsan');
  transferService.approve(transfer4.id, 'emp-admin');
  transferService.complete(transfer4.id, 'emp-zhoujiu');
  printSuccess('asset-002 已调拨到财务部');

  printSubHeader('3. 查看调拨后的折旧报表');
  const reportAfter = reportService.getComprehensiveReport();
  printSuccess('调拨后折旧报表变化', reportAfter.depreciationSummary.byDepartment.map(d => ({
    department: d.department,
    assetCount: d.assetCount,
    netBookValue: d.netBookValue,
    monthlyDepreciation: d.monthlyDepreciation
  })));

  printSeparator();
  printSuccess('场景五完成: 折旧部门随调拨自动更新，报表数据正确反映变化');

  printHeader('场景六: 后台任务（失败和重试机制）');
  
  printSubHeader('1. 查看当前任务列表（为空）');
  let tasks = taskService.listTasks();
  printSuccess('当前任务数', { count: tasks.length });

  printSubHeader('2. 创建一个会失败的任务（模拟财务系统连接超时）');
  const failingTask = taskService.createTask('UPDATE_FINANCE_AFTER_TRANSFER', {
    transferId: 'test-transfer-001',
    assetNo: 'LT-TEST',
    outgoingDepartment: '研发部',
    incomingDepartment: '市场部',
    simulateFailure: true
  }, { maxRetries: 2, initialDelay: 500 });
  printSuccess('失败任务已创建', {
    taskId: failingTask.id,
    type: failingTask.type,
    maxRetries: failingTask.retryConfig.maxRetries
  });

  printSubHeader('3. 执行任务（会失败并进入 RETRYING 状态）');
  let result1 = await taskService.executeTask(failingTask);
  printSuccess('第一次执行结果', {
    success: result1.success,
    willRetry: result1.willRetry,
    attemptCount: result1.retryAttempt,
    nextAttemptAt: result1.nextAttemptAt
  });
  printSuccess('任务当前状态', {
    status: failingTask.status,
    error: failingTask.error?.message
  });

  printSubHeader('4. 再次执行任务（第二次也是最后一次机会）');
  failingTask.nextAttemptAt = new Date(Date.now() - 1000).toISOString();
  let result2 = await taskService.executeTask(failingTask);
  printSuccess('第二次执行结果', {
    success: result2.success,
    willRetry: result2.willRetry,
    attemptCount: result2.retryAttempt,
    maxRetries: result2.maxRetries
  });
  printSuccess('任务最终状态', {
    status: failingTask.status,
    attemptCount: failingTask.attemptCount
  });

  printSubHeader('5. 验证不能重试超过最大次数');
  const canRetry = taskService.canRetry(failingTask);
  printSuccess('是否还能重试', { canRetry });

  printSubHeader('6. 创建一个正常的成功任务');
  const successTask = taskService.createTask('SEND_NOTIFICATION', {
    type: 'TEST',
    recipient: 'test-user',
    message: '这是一个测试通知'
  });
  let result3 = await taskService.executeTask(successTask);
  printSuccess('成功任务执行结果', {
    success: result3.success,
    result: result3.task.result
  });

  printSeparator();
  printSuccess('场景六完成: 后台任务具有重试机制，失败会记录错误，达到最大次数后状态为 FAILED');

  printHeader('场景七: 版本号冲突检测（乐观锁）');
  
  printSubHeader('1. 获取资产当前版本');
  const asset004 = assetService.getAssetById('asset-004');
  const oldVersion = asset004.version;
  printSuccess('asset-004 当前版本', { version: asset004.version });

  printSubHeader('2. 使用正确版本号更新（成功）');
  const updated1 = assetService.updateAsset(
    'asset-004',
    { responsiblePerson: '更新测试1' },
    oldVersion
  );
  printSuccess('更新成功', {
    newVersion: updated1.version,
    responsiblePerson: updated1.responsiblePerson
  });

  printSubHeader('3. 使用旧版本号再次更新（失败 - 版本冲突）');
  try {
    assetService.updateAsset(
      'asset-004',
      { responsiblePerson: '更新测试2' },
      oldVersion
    );
    console.log('     ❌ 期望失败但成功了');
  } catch (e) {
    printError(e);
  }

  printSeparator();
  printSuccess('场景七完成: 乐观锁机制防止并发更新冲突');

  printHeader('📊 综合报表');
  const finalReport = reportService.getComprehensiveReport();
  
  printSubHeader('资产概览');
  printSuccess('', {
    totalAssets: finalReport.assetOverview.totalAssets,
    totalValue: finalReport.assetOverview.totalOriginalValue,
    byStatus: finalReport.assetOverview.byStatus
  });

  printSubHeader('调拨统计');
  printSuccess('', finalReport.transferStatistics);

  printSubHeader('风险预警');
  printSuccess(`发现 ${finalReport.alerts.count} 个风险项`, 
    finalReport.alerts.items.map(a => ({
      assetNo: a.assetNo,
      alertType: a.alertType,
      detail: a.detail
    }))
  );

  printHeader('✅ 所有场景演示完成');
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    关键规则总结                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  1. 调拨状态流转严格控制                                  ║');
  console.log('║     草稿 → 待审批 → (已批准/已拒绝) → 已完成/已取消        ║');
  console.log('║  2. 调拨完成后自动更新责任人和折旧部门                    ║');
  console.log('║  3. 同一资产不能同时有多个进行中的调拨单                   ║');
  console.log('║  4. 盘亏资产不允许调拨，需先处理盘点差异                   ║');
  console.log('║  5. 调出责任人不能审批自己的调拨单                        ║');
  console.log('║  6. 资产更新使用版本号防止并发冲突                        ║');
  console.log('║  7. 后台任务支持重试机制，失败原因可查                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

runScenarios().catch(console.error);
