import { AuditService } from '../services/AuditService';
import { ReportGenerator } from '../services/ReportGenerator';

function runSelfCheck() {
  console.log('='.repeat(60));
  console.log('数据库索引建议审计系统 - 自检程序');
  console.log('='.repeat(60));
  console.log('');

  const auditService = new AuditService();
  const reportGenerator = new ReportGenerator();

  let passed = 0;
  let failed = 0;

  console.log('📋 测试 1: 验证模拟数据加载');
  try {
    const workOrders = auditService.getWorkOrders();
    console.log(`   ✓ 工单数据: ${workOrders.length} 条`);

    workOrders.forEach(wo => {
      console.log(`     - ${wo.orderNo}: ${wo.title} (${workOrders.length} 个附件)`);
    });
    passed++;
  } catch (e) {
    console.log(`   ✗ 工单数据加载失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 2: 执行审计功能');
  let auditResult: any;
  try {
    auditResult = auditService.performAudit('self-check');
    console.log(`   ✓ 审计执行成功`);
    console.log(`     - 工单总数: ${auditResult.summary.totalRecords}`);
    console.log(`     - 正常记录: ${auditResult.summary.normalCount}`);
    console.log(`     - 异常记录: ${auditResult.summary.exceptionCount}`);
    console.log(`     - 严重异常: ${auditResult.summary.criticalCount}`);
    console.log(`     - 主要异常: ${auditResult.summary.majorCount}`);
    console.log(`     - 执行时长: ${auditResult.execution.durationMs}ms`);
    passed++;
  } catch (e) {
    console.log(`   ✗ 审计执行失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 3: 验证异常检测');
  try {
    if (auditResult && auditResult.exceptionRecords.length > 0) {
      console.log(`   ✓ 检测到 ${auditResult.exceptionRecords.length} 个异常`);
      auditResult.exceptionRecords.forEach((ex: any, idx: number) => {
        console.log(`     ${idx + 1}. [${ex.severity}] ${ex.message}`);
      });
    } else {
      console.log('   - 未检测到异常');
    }
    passed++;
  } catch (e) {
    console.log(`   ✗ 异常检测验证失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 4: 生成 JSON 报告');
  try {
    const jsonReport = reportGenerator.generate(auditResult, 'json');
    if (jsonReport.content && jsonReport.content.length > 0) {
      console.log(`   ✓ JSON 报告生成成功 (${jsonReport.content.length} 字符)`);
      passed++;
    } else {
      console.log('   ✗ JSON 报告内容为空');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ JSON 报告生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 5: 生成 Markdown 报告');
  try {
    const mdReport = reportGenerator.generate(auditResult, 'markdown');
    if (mdReport.content && mdReport.content.length > 0) {
      console.log(`   ✓ Markdown 报告生成成功 (${mdReport.content.length} 字符)`);
      passed++;
    } else {
      console.log('   ✗ Markdown 报告内容为空');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ Markdown 报告生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 6: 生成下载格式报告');
  try {
    const downloadReport = reportGenerator.generate(auditResult, 'download');
    if (downloadReport.content && downloadReport.content.length > 0) {
      console.log(`   ✓ 下载格式报告生成成功 (${downloadReport.content.length} 字符)`);
      passed++;
    } else {
      console.log('   ✗ 下载格式报告内容为空');
      failed++;
    }
  } catch (e) {
    console.log(`   ✗ 下载格式报告生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 7: 生成失败项清单');
  try {
    const failJson = reportGenerator.failRecordsToJSON(auditResult.exceptionRecords);
    const failMd = reportGenerator.failRecordsToMarkdown(auditResult.exceptionRecords);
    console.log(`   ✓ 失败项清单生成成功`);
    console.log(`     - JSON 格式: ${failJson.length} 字符`);
    console.log(`     - Markdown 格式: ${failMd.length} 字符`);
    passed++;
  } catch (e) {
    console.log(`   ✗ 失败项清单生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 8: 生成清理候选清单');
  try {
    const cleanupCandidates = auditService.generateCandidateList('cleanup');
    console.log(`   ✓ 清理候选清单生成成功 (${cleanupCandidates.length} 项)`);
    cleanupCandidates.forEach((c, idx) => {
      console.log(`     ${idx + 1}. [${c.riskLevel}] ${c.description}`);
    });
    passed++;
  } catch (e) {
    console.log(`   ✗ 清理候选清单生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 9: 生成回滚候选清单');
  try {
    const rollbackCandidates = auditService.generateCandidateList('rollback');
    console.log(`   ✓ 回滚候选清单生成成功 (${rollbackCandidates.length} 项)`);
    rollbackCandidates.forEach((c, idx) => {
      console.log(`     ${idx + 1}. [${c.riskLevel}] ${c.description}`);
    });
    passed++;
  } catch (e) {
    console.log(`   ✗ 回滚候选清单生成失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 10: 按来源系统查询审计日志');
  try {
    const logs = auditService.getAuditLogsBySourceSystem('cloud_resource');
    console.log(`   ✓ 审计日志查询成功 (${logs.length} 条)`);
    logs.forEach(log => {
      console.log(`     - 操作: ${log.action}, 原因: ${log.reason}`);
      console.log(`       变更前: ${JSON.stringify(log.beforeData)}`);
      console.log(`       变更后: ${JSON.stringify(log.afterData)}`);
    });
    passed++;
  } catch (e) {
    console.log(`   ✗ 审计日志查询失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 11: 验证下一步建议生成');
  try {
    if (auditResult && auditResult.nextSteps.length > 0) {
      console.log(`   ✓ 生成 ${auditResult.nextSteps.length} 条下一步建议`);
      auditResult.nextSteps.forEach((step: any, idx: number) => {
        console.log(`     ${idx + 1}. [${step.priority}] ${step.action} - ${step.responsible}`);
      });
      passed++;
    } else {
      console.log('   - 未生成下一步建议');
    }
  } catch (e) {
    console.log(`   ✗ 下一步建议验证失败: ${(e as Error).message}`);
    failed++;
  }
  console.log('');

  console.log('📋 测试 12: 边界情况测试 - 无效报告格式');
  try {
    reportGenerator.generate(auditResult, 'invalid' as any);
    console.log('   ✗ 未抛出预期错误');
    failed++;
  } catch (e) {
    console.log(`   ✓ 正确抛出错误: ${(e as Error).message}`);
    passed++;
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('自检结果汇总');
  console.log('='.repeat(60));
  console.log(`通过: ${passed} 项`);
  console.log(`失败: ${failed} 项`);
  console.log('');

  if (failed === 0) {
    console.log('✅ 所有测试通过！系统运行正常。');
  } else {
    console.log('❌ 部分测试失败，请检查系统配置。');
  }
  console.log('');

  return failed === 0;
}

if (require.main === module) {
  const success = runSelfCheck();
  process.exit(success ? 0 : 1);
}
