import { setupAcceptanceData } from './data/acceptanceData';
import { refundReviewService } from './services/refundReviewService';
import { exportService } from './services/exportService';
import { dataStore } from './store/dataStore';
import { ReviewConclusion, RefundReviewStatus } from './types';

async function runDemo() {
  console.log('========================================');
  console.log('  订单风控平台异常退款拦截复核系统演示');
  console.log('========================================\n');

  const { reviewId, splitReviewId, importBatchId } = setupAcceptanceData();

  console.log('\n========================================');
  console.log('  功能演示 1: 列表查询');
  console.log('========================================');
  const listResult = refundReviewService.listRefundReviews(1, 10);
  console.log('总条数:', listResult.data?.total);
  console.log('列表数据预览:');
  listResult.data?.list.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.orderInfo.orderNo} - ${item.status} - ${item.orderInfo.goodsName}`);
  });

  console.log('\n========================================');
  console.log('  功能演示 2: 详情查询（带业务标签）');
  console.log('========================================');
  const detailResult = refundReviewService.getReviewDetailWithLabels(reviewId);
  console.log('订单编号:', detailResult.data?.orderInfo.orderNo);
  console.log('商品名称:', detailResult.data?.orderInfo.goodsName);
  console.log('当前状态:', detailResult.data?.statusLabel);
  console.log('退款原因:', detailResult.data?.refundReasonLabel);
  console.log('风控标签:', detailResult.data?.riskTagLabels?.join('; '));
  console.log('复核结论:', detailResult.data?.reviewConclusionLabel);
  console.log('人工备注:', detailResult.data?.manualRemark);

  console.log('\n========================================');
  console.log('  功能演示 3: 审计日志');
  console.log('========================================');
  const auditResult = refundReviewService.getAuditLogs(reviewId);
  auditResult.data?.forEach((log, index) => {
    console.log(`  ${index + 1}. [${log.actionLabel}] ${log.operatorName || '系统'} - ${log.remark}`);
  });

  console.log('\n========================================');
  console.log('  功能演示 4: 拆单绕开阈值-添加备注后复核');
  console.log('========================================');
  console.log('1. 先添加人工备注...');
  const remarkResult = refundReviewService.addManualRemark(splitReviewId, {
    manualRemark: '与用户电话核实，确为分开购买不同商品，非恶意拆单',
    operatorId: 'admin_001',
    operatorName: '张经理'
  });
  console.log('   备注结果:', remarkResult.businessMessage);

  console.log('2. 执行复核...');
  const reviewResult = refundReviewService.review(splitReviewId, {
    reviewConclusion: ReviewConclusion.MANUAL_REJECT,
    reviewRemark: '核实后认为存在风险，拒绝退款',
    operatorId: 'admin_001',
    operatorName: '张经理'
  });
  console.log('   复核结果:', reviewResult.businessMessage);
  console.log('   最终状态:', reviewResult.data?.status);

  console.log('\n========================================');
  console.log('  功能演示 5: 冲突记录查询');
  console.log('========================================');
  const conflicts = dataStore.listConflictRecords(splitReviewId);
  conflicts.forEach((c, index) => {
    console.log(`  ${index + 1}. [${c.conflictType}] ${c.conflictMessage} - ${c.operatorName}`);
  });

  console.log('\n========================================');
  console.log('  功能演示 6: 导入坏行查询');
  console.log('========================================');
  const badRows = dataStore.listImportBadRows(importBatchId);
  badRows.forEach((row, index) => {
    console.log(`  ${index + 1}. 第${row.rowNumber}行 - ${row.errorMessage} (字段: ${row.errorFields.join(',')})`);
  });

  console.log('\n========================================');
  console.log('  功能演示 7: 导出字段配置');
  console.log('========================================');
  const fieldConfig = exportService.getExportFieldConfig();
  fieldConfig.data?.forEach(f => {
    console.log(`  ${f.label} (${f.field})`);
  });

  console.log('\n========================================');
  console.log('  功能演示 8: 幂等性验证');
  console.log('========================================');
  const duplicateResult = refundReviewService.createRefundReview({
    orderInfo: {
      orderId: 'test_order',
      orderNo: 'ORD_TEST_001',
      userId: 'test_user',
      orderAmount: 100,
      refundAmount: 100,
      createTime: new Date().toISOString(),
      goodsName: '测试商品',
      goodsId: 'test_goods'
    },
    refundReason: 'QUALITY_ISSUE' as any,
    riskTags: [],
    idempotentKey: 'idem_normal_001'
  });
  console.log('重复请求结果:', duplicateResult.success ? '成功（异常）' : '失败（正常）');
  console.log('业务错误码:', duplicateResult.businessCode);
  console.log('业务错误信息:', duplicateResult.businessMessage);

  console.log('\n========================================');
  console.log('  演示完成！');
  console.log('========================================');
}

runDemo().catch(console.error);
