const { initializeSampleData } = require('./data/sampleData');
const orderService = require('./services/OrderService');
const complaintService = require('./services/ComplaintService');
const logger = require('./utils/logger');

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

function printSubSection(title) {
  console.log('\n  --- ' + title + ' ---');
}

function formatMoney(amount) {
  return '¥' + amount.toFixed(2);
}

function formatWeight(weight) {
  if (weight === null || weight === undefined) return '-';
  return weight.toFixed(3) + ' kg';
}

async function runDemo() {
  logger.info('开始运行演示脚本...');
  logger.info('正在初始化样例数据...\n');

  const samples = await initializeSampleData();

  console.log('\n' + '#'.repeat(70));
  console.log('#           社区团购缺斤赔付 API 系统演示');
  console.log('#'.repeat(70));

  const complaint1 = samples.complaints['场景1: 正常缺斤赔付'];
  const complaint2 = samples.complaints['场景2: 正常驳回(误差容忍)'];
  const complaint3 = samples.complaints['场景3: 证据不足驳回'];
  const complaint4_first = samples.complaints['场景4-1: 原始投诉'];
  const complaint4_duplicate = samples.complaints['场景4-2: 重复投诉(自动驳回)'];
  const complaint5 = samples.complaints['场景5: 超时投诉(48小时外)'];
  const complaint6 = samples.complaints['场景6: 部分商品缺斤(支付失败进入异常)'];
  const complaint7 = samples.complaints['场景7: 待审批(可演示审批+人工修正)'];

  printSection('【流程1】正常缺斤赔付 - 完整闭环流程');
  
  const detail1 = complaintService.getComplaintDetail(complaint1.id);
  console.log('\n  投诉单号:', detail1.complaint.complaintNo);
  console.log('  订单号:', detail1.complaint.orderNo);
  console.log('  当前状态:', detail1.complaint.status);
  
  printSubSection('订单重量链路');
  detail1.weightChain.items.forEach(item => {
    console.log(`    商品: ${item.productName}`);
    console.log(`      期望重量: ${formatWeight(item.expectedWeight)}`);
    console.log(`      实际重量: ${formatWeight(item.actualWeight)}`);
    console.log(`      差值: ${formatWeight(item.diff)}`);
    console.log(`      单价: ${formatMoney(item.unitPrice)}/kg`);
  });

  printSubSection('赔付金额计算');
  const trial1 = detail1.trialCalculation;
  if (trial1) {
    trial1.items.forEach(item => {
      console.log(`    商品: ${item.productName}`);
      console.log(`      期望重量: ${formatWeight(item.expectedWeight)}`);
      console.log(`      实际重量: ${formatWeight(item.actualWeight)}`);
      console.log(`      缺斤重量: ${formatWeight(item.shortageWeight)} (${item.shortagePercent.toFixed(1)}%)`);
      console.log(`      基础赔付: ${formatMoney(item.baseCompensation)}`);
      console.log(`      赔付倍率: ${item.compensationRatio}x (${item.penaltyApplied ? '已触发惩罚赔付' : '基础赔付'})`);
      console.log(`      最终赔付: ${formatMoney(item.finalCompensation)}`);
    });
    console.log(`\n    总缺斤重量: ${formatWeight(trial1.totalShortageWeight)}`);
    console.log(`    总赔付金额: ${formatMoney(trial1.totalCompensationAmount)}`);
  }

  printSubSection('审核历史记录');
  detail1.history.forEach((h, idx) => {
    console.log(`    [${idx + 1}] ${new Date(h.timestamp).toLocaleString()}`);
    console.log(`        操作: ${h.action}`);
    console.log(`        状态变化: ${h.fromStatus} -> ${h.toStatus}`);
    console.log(`        操作人: ${h.operatorName} (${h.operatorId})`);
    if (h.description) console.log(`        说明: ${h.description}`);
    if (h.diffBefore || h.diffAfter) {
      if (h.diffBefore) console.log(`        变更前: ${JSON.stringify(h.diffBefore)}`);
      if (h.diffAfter) console.log(`        变更后: ${JSON.stringify(h.diffAfter)}`);
    }
  });

  printSection('【流程2】正常驳回 - 称重误差容忍范围内');
  
  console.log('\n  投诉单号:', complaint2.complaintNo);
  console.log('  订单号:', complaint2.orderNo);
  console.log('  当前状态:', complaint2.status);
  console.log('  驳回原因:', complaint2.rejectReason);
  console.log('  驳回说明:', complaint2.rejectNote);
  console.log('\n  规则说明:');
  console.log('    橙子购买 1.5kg，实际称重 1.48kg');
  console.log('    缺斤 0.02kg (20g)，在 2% 或 0.02kg 容忍范围内');
  console.log('    系统自动判定为正常误差，不予赔付');

  printSection('【流程3】证据不足驳回 - 缺少称重照片');
  
  console.log('\n  投诉单号:', complaint3.complaintNo);
  console.log('  订单号:', complaint3.orderNo);
  console.log('  当前状态:', complaint3.status);
  console.log('  驳回原因:', complaint3.rejectReason);
  console.log('  驳回说明:', complaint3.rejectNote);
  console.log('  证据数量:', complaint3.evidences.length);
  console.log('\n  原因: 用户只口头声称缺斤，未提供称重照片或其他证据');

  printSection('【流程4】重复投诉检测 - 7天内同订单同商品自动驳回');
  
  console.log('\n  原始投诉:');
  console.log('    单号:', complaint4_first.complaintNo);
  console.log('    状态:', complaint4_first.status);
  
  console.log('\n  重复投诉:');
  console.log('    单号:', complaint4_duplicate.complaintNo);
  console.log('    状态:', complaint4_duplicate.status);
  console.log('    驳回原因:', complaint4_duplicate.rejectReason);
  console.log('    关联原始投诉:', complaint4_duplicate.isDuplicateOf);
  console.log('    说明:', complaint4_duplicate.rejectNote);

  printSection('【流程5】超时投诉 - 超过48小时投诉时限');
  
  console.log('\n  投诉单号:', complaint5.complaintNo);
  console.log('  当前状态:', complaint5.status);
  console.log('  驳回原因:', complaint5.rejectReason);
  console.log('  说明:', complaint5.rejectNote);
  console.log('\n  时间线:');
  console.log('    配送时间:', new Date(complaint5.filedTime).toLocaleString());
  console.log('    (样例设置为配送后约50小时才投诉，超过48小时时限)');

  printSection('【流程6】部分商品缺斤 + 支付失败异常处理');
  
  const detail6 = complaintService.getComplaintDetail(complaint6.id);
  console.log('\n  投诉单号:', detail6.complaint.complaintNo);
  console.log('  当前状态:', detail6.complaint.status);
  console.log('  异常原因:', detail6.complaint.exceptionReason);
  
  printSubSection('试算结果(部分商品)');
  const trial6 = detail6.trialCalculation;
  if (trial6) {
    console.log('  符合赔付条件的商品:');
    trial6.items.forEach(item => {
      console.log(`    - ${item.productName}: 缺斤 ${formatWeight(item.shortageWeight)}, 赔付 ${formatMoney(item.finalCompensation)}`);
    });
    if (trial6.ineligibleItems && trial6.ineligibleItems.length > 0) {
      console.log('\n  不符合赔付条件的商品:');
      trial6.ineligibleItems.forEach(item => {
        console.log(`    - ${item.productName}: ${item.reason}`);
        console.log(`      期望: ${formatWeight(item.expectedWeight)}, 实际: ${formatWeight(item.actualWeight)}, 差值: ${formatWeight(item.diff)}`);
      });
    }
    console.log(`\n  最终赔付金额: ${formatMoney(trial6.totalCompensationAmount)}`);
  }
  
  printSubSection('支付记录');
  detail6.payments.forEach(p => {
    console.log(`    支付单号: ${p.paymentNo}`);
    console.log(`    金额: ${formatMoney(p.amount)}`);
    console.log(`    状态: ${p.status}`);
    console.log(`    回调结果: ${p.callbackResult ? JSON.stringify(p.callbackResult) : '-'}`);
  });

  printSection('【流程7】待审批状态 - 演示人工操作');
  
  console.log('\n  投诉单号:', complaint7.complaintNo);
  console.log('  当前状态:', complaint7.status);
  console.log('  订单号:', complaint7.orderNo);
  
  const trial7 = complaint7.trialCalculation;
  if (trial7) {
    console.log('\n  待确认赔付:');
    trial7.items.forEach(item => {
      console.log(`    ${item.productName}: 缺斤 ${formatWeight(item.shortageWeight)} (${item.shortagePercent.toFixed(1)}%)`);
      console.log(`      期望赔付: ${formatMoney(item.finalCompensation)}`);
    });
    console.log(`    总计: ${formatMoney(trial7.totalCompensationAmount)}`);
  }

  printSubSection('演示: 人工修正赔付金额');
  const correction = complaintService.manualCorrect(
    complaint7.id,
    {
      trialCalculation: {
        totalCompensationAmount: (trial7?.totalCompensationAmount || 0) + 10
      },
      description: '客服特批，额外补偿10元'
    },
    'admin-001',
    '高级管理员'
  );
  
  console.log('\n  人工修正结果:');
  console.log('    操作人:', correction.operator.name);
  console.log('    变更前:', JSON.stringify(correction.diffBefore));
  console.log('    变更后:', JSON.stringify(correction.diffAfter));
  
  printSubSection('修正后的完整历史记录');
  const updatedDetail7 = complaintService.getComplaintDetail(complaint7.id);
  updatedDetail7.history.forEach((h, idx) => {
    console.log(`    [${idx + 1}] ${new Date(h.timestamp).toLocaleString()}`);
    console.log(`        操作: ${h.action}`);
    if (h.diffBefore || h.diffAfter) {
      if (h.diffBefore) console.log(`        变更前: ${JSON.stringify(h.diffBefore)}`);
      if (h.diffAfter) console.log(`        变更后: ${JSON.stringify(h.diffAfter)}`);
    }
  });

  printSection('【统计分析】团长责任统计与数据报告');
  
  const stats = complaintService.getStatistics({});
  
  console.log('\n  总体统计:');
  console.log('    总投诉数:', stats.totalComplaints);
  console.log('    总赔付金额:', formatMoney(stats.totalCompensation));
  console.log('    已支付金额:', formatMoney(stats.paidCompensation));
  console.log('    待支付金额:', formatMoney(stats.pendingCompensation));
  
  console.log('\n  状态分布:');
  Object.entries(stats.statusStats).forEach(([status, count]) => {
    console.log(`    ${status}: ${count} 单`);
  });
  
  console.log('\n  驳回原因分布:');
  Object.entries(stats.reasonStats).forEach(([reason, count]) => {
    console.log(`    ${reason}: ${count} 单`);
  });
  
  console.log('\n  团长责任统计:');
  stats.groupLeaderResponsibility.forEach(gl => {
    console.log(`\n    团长 ${gl.groupLeaderId}:`);
    console.log(`      总投诉数: ${gl.totalComplaints}`);
    console.log(`      已驳回: ${gl.rejectedComplaints}`);
    console.log(`      已通过: ${gl.approvedComplaints}`);
    console.log(`      驳回率: ${gl.rejectRate}%`);
    console.log(`      总赔付金额: ${formatMoney(gl.totalCompensation)}`);
  });

  printSection('【报告导出】完整数据报告');
  
  const report = complaintService.exportReport({});
  console.log('\n  报告生成时间:', new Date(report.generatedAt).toLocaleString());
  console.log('  汇总信息:');
  console.log('    总投诉数:', report.summary.totalComplaints);
  console.log('    状态统计:', JSON.stringify(report.summary.statusStats));
  console.log('    赔付金额:', formatMoney(report.summary.totalCompensation));
  
  console.log('\n  明细记录 (共', report.details.length, '条):');
  report.details.forEach((row, idx) => {
    console.log(`\n    [${idx + 1}] ${row.投诉单号}`);
    console.log(`        订单号: ${row.订单号}`);
    console.log(`        团长: ${row.团长ID}`);
    console.log(`        状态: ${row.投诉状态}`);
    if (row.赔付金额) console.log(`        赔付金额: ${formatMoney(row.赔付金额)}`);
    if (row.驳回说明) console.log(`        驳回说明: ${row.驳回说明}`);
  });

  printSection('演示完成');
  console.log('\n  您可以:');
  console.log('  1. 运行 `npm start` 启动API服务');
  console.log('  2. 访问 `http://localhost:3000/health` 检查服务状态');
  console.log('  3. 参考上面的投诉单号，通过API查询详情:');
  console.log('     GET /api/complaints/:complaintId');
  console.log('  4. 查看统计: GET /api/complaints/stats/summary');
  console.log('  5. 导出报告: GET /api/complaints/report/export');
  console.log('\n' + '#'.repeat(70) + '\n');
}

runDemo().catch(error => {
  logger.error('演示脚本运行失败', error);
  process.exit(1);
});
