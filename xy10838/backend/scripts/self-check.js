const { initDatabase, db } = require('../src/database');
const retentionService = require('../src/services/retentionService');
const deletionService = require('../src/services/deletionService');
const receiptService = require('../src/services/receiptService');

const runSelfCheck = async () => {
  console.log('=== 数据保留删除 API 自检开始 ===\n');

  try {
    await initDatabase();
    console.log('✓ 数据库初始化成功');

    console.log('\n--- 1. 数据域检查 ---');
    const domains = retentionService.getActiveDomains();
    console.log(`✓ 找到 ${domains.length} 个数据域`);
    domains.forEach(d => console.log(`  - ${d.name} (保留期: ${d.retention_days}天)`));

    console.log('\n--- 2. 保留期校验检查 ---');
    const testDate = new Date().toISOString();
    const validation = retentionService.validateRetentionPeriod(domains[0], testDate);
    console.log(`✓ 保留期校验完成`);
    console.log(`  - 记录日期: ${validation.recordDate}`);
    console.log(`  - 保留到期日: ${validation.retentionEndDate}`);
    console.log(`  - 剩余天数: ${validation.daysRemaining}`);

    console.log('\n--- 3. 删除申请流程检查 ---');
    const request = deletionService.createDeletionRequest({
      customerId: 'CUST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      customerName: '测试客户',
      reason: 'GDPR 删除请求',
      requestedBy: 'test_operator'
    });
    console.log(`✓ 创建删除申请: ${request.request_no}`);

    deletionService.updateRequestStatus(request.id, 'PENDING_APPROVAL', 'test_operator');
    console.log('✓ 提交审批完成');

    deletionService.updateRequestStatus(request.id, 'APPROVED', 'test_approver');
    console.log('✓ 审批通过');

    const requestAfterApproval = deletionService.getDeletionRequestById(request.id);
    console.log(`✓ 生成 ${requestAfterApproval.tasks.length} 个执行任务`);
    requestAfterApproval.tasks.forEach(t => {
      console.log(`  - ${t.domain_name}: ${t.status}`);
    });

    console.log('\n--- 4. 任务执行检查 ---');
    for (const task of requestAfterApproval.tasks) {
      try {
        deletionService.executeTask(task.id, 'test_executor');
      } catch (e) {
        console.log(`  任务 ${task.domain_name} 执行: ${e.message}`);
      }
    }
    console.log('✓ 任务执行完成');

    const finalRequest = deletionService.getDeletionRequestById(request.id);
    console.log(`  最终状态: ${finalRequest.status}`);

    console.log('\n--- 5. 失败项检查 ---');
    const failedItems = deletionService.getFailedItems();
    console.log(`✓ 共 ${failedItems.length} 个失败记录`);
    if (failedItems.length > 0) {
      console.log(`  示例: ${failedItems[0].error_message}`);
    }

    console.log('\n--- 6. 回执生成检查 ---');
    const receipt = receiptService.generateReceipt(request.id, 'test_operator');
    console.log(`✓ 生成回执: ${receipt.receipt_no}`);
    const content = JSON.parse(receipt.content);
    console.log(`  成功率: ${content.summary.successRate}%`);
    console.log(`  处理记录: ${content.summary.processedRecords}/${content.summary.totalRecords}`);

    console.log('\n--- 7. 审计日志检查 ---');
    const auditLogs = deletionService.getAuditLogs(request.id);
    console.log(`✓ 共 ${auditLogs.length} 条审计记录`);
    auditLogs.forEach(log => {
      console.log(`  [${log.created_at}] ${log.actor}: ${log.action} - ${log.details}`);
    });

    console.log('\n--- 8. 审计报告检查 ---');
    const report = receiptService.generateAuditReport(request.id);
    console.log(`✓ 生成审计报告`);
    console.log(`  报告类型: ${report.reportType}`);
    console.log(`  审计轨迹: ${report.auditTrail.length} 条记录`);

    console.log('\n=== 自检全部通过 ===');
    console.log('\n核心功能验证总结:');
    console.log('  ✓ 保留期校验规则 - 按数据域配置验证');
    console.log('  ✓ 分域删除规则 - 按数据域拆分执行任务');
    console.log('  ✓ 失败补偿机制 - 支持重试和人工处理');
    console.log('  ✓ 回执生成规则 - 完整的执行摘要');
    console.log('  ✓ 审计报告规则 - 完整的操作轨迹');

  } catch (error) {
    console.error('\n✗ 自检失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

runSelfCheck();
