const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const services = require('../src/services');
const rules = require('../src/rules');
const utils = require('../src/utils');

const section = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(` ${title}`);
  console.log('='.repeat(60));
};

const run = async () => {
  console.log('\n🚀 企业访客餐券系统 - 正常流程演示');
  
  section('1. 环境准备 - 检查基础数据');
  await services.ensureDb();
  
  const depts = await services.listDepartments();
  const stalls = await services.listStalls();
  if (depts.length === 0 || stalls.length === 0) {
    console.log('⚠️  检测到未初始化数据，正在执行初始化...');
    require('./seed');
    await services.ensureDb();
  }
  console.log('✅ 基础数据就绪');
  console.log(`  部门数: ${(await services.listDepartments()).length}`);
  console.log(`  档口数: ${(await services.listStalls()).length}`);
  
  section('2. 场景一：正常发券核销流程 (张三-阿里巴巴)');
  
  const apptId = 'appt-normal-001';
  const stallId = 'stall-1';
  
  console.log('\n[步骤1] 访客签到');
  let appt = await services.checkInVisitor(apptId, '行政前台-小王');
  console.log(`  预约状态: ${appt.status}`);
  console.log(`  实际到达时间: ${appt.actual_arrival_time}`);
  
  console.log('\n[步骤2] 发放餐券 (检查预算)');
  const voucher = await services.issueVoucher({
    appointment_id: apptId,
    amount: 50,
    request_id: 'req-issue-001'
  }, '行政前台-小王');
  console.log(`  券码: ${voucher.voucher_code}`);
  console.log(`  状态: ${voucher.status}`);
  console.log(`  金额: ¥${voucher.amount}`);
  console.log(`  有效期: ${voucher.valid_from} ~ ${voucher.valid_to}`);
  console.log(`  幂等标记: ${voucher.is_idempotent}`);
  
  const itDept = await services.getDepartment('dept-it');
  console.log(`  信息技术部预算剩余: ¥${itDept.remaining_budget}`);
  
  console.log('\n[步骤3] 档口核销 (中式快餐档口)');
  const redeemed = await services.redeemVoucher({
    voucher_code: voucher.voucher_code,
    stall_id: stallId,
    request_id: 'req-redeem-001'
  }, '档口操作员-老李');
  console.log(`  核销后状态: ${redeemed.status}`);
  console.log(`  核销档口: ${redeemed.redemption.stall.name}`);
  console.log(`  核销时间: ${redeemed.redemption.redeemed_at}`);
  
  console.log('\n[步骤4] 查询访客用餐状态');
  const mealStatus = await services.getVisitorMealStatus(apptId);
  console.log('  ', JSON.stringify(mealStatus, null, 2));
  
  section('3. 场景二：过期回收流程 (李四-腾讯)');
  
  const expiredApptId = 'appt-expired-001';
  
  console.log('\n[步骤1] 访客签到');
  await services.checkInVisitor(expiredApptId, '行政前台-小王');
  
  console.log('\n[步骤2] 发放餐券 (设置已过期的券)');
  const pastDate = utils.now().subtract(2, 'day');
  const expiredVoucher = await services.issueVoucher({
    appointment_id: expiredApptId,
    amount: 50,
    valid_from: pastDate.format('YYYY-MM-DD HH:mm:ss'),
    valid_to: pastDate.add(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  }, '行政前台-小王');
  console.log(`  券码: ${expiredVoucher.voucher_code}`);
  console.log(`  有效期至: ${expiredVoucher.valid_to}`);
  
  const hrDeptBefore = await services.getDepartment('dept-hr');
  console.log(`  HR部发放后剩余预算: ¥${hrDeptBefore.remaining_budget}`);
  
  console.log('\n[步骤3] 执行过期回收');
  const expireResult = await services.expireVouchers();
  console.log(`  过期数量: ${expireResult.expired_count}`);
  expireResult.vouchers.forEach(v => {
    console.log(`    券 ${v.voucher_code}: ${v.status}`);
  });
  
  const hrDeptAfter = await services.getDepartment('dept-hr');
  console.log(`  HR部回收后剩余预算: ¥${hrDeptAfter.remaining_budget}`);
  
  section('4. 场景三：作废流程 (孙七-美团)');
  
  const voidApptId = 'appt-void-001';
  
  console.log('\n[步骤1] 访客签到');
  await services.checkInVisitor(voidApptId, '行政前台-小王');
  
  console.log('\n[步骤2] 发放餐券');
  const voidVoucher = await services.issueVoucher({
    appointment_id: voidApptId,
    amount: 50
  }, '行政前台-小王');
  console.log(`  券码: ${voidVoucher.voucher_code}`);
  
  const salesBefore = await services.getDepartment('dept-sales');
  console.log(`  销售部发券后剩余: ¥${salesBefore.remaining_budget}`);
  
  console.log('\n[步骤3] 人工作废 (访客临时取消用餐)');
  const voided = await services.voidVoucher(voidVoucher.id, '访客临时取消，不需要用餐', '行政经理-张经理');
  console.log(`  作废后状态: ${voided.status}`);
  console.log(`  作废原因: ${voided.void_reason}`);
  console.log(`  作废人: ${voided.voided_by}`);
  
  const salesAfter = await services.getDepartment('dept-sales');
  console.log(`  销售部作废后剩余: ¥${salesAfter.remaining_budget}`);
  
  section('5. 场景四：幂等性验证');
  
  console.log('\n[验证] 重复执行发券请求 (相同request_id)');
  try {
    const idempotentResult = await services.issueVoucher({
      appointment_id: apptId,
      amount: 50,
      request_id: 'req-issue-001'
    }, '行政前台-小王', 'req-issue-001');
    console.log(`  幂等结果: is_idempotent = ${idempotentResult.is_idempotent}`);
    console.log(`  返回的券码相同: ${idempotentResult.voucher_code === voucher.voucher_code ? '✅' : '❌'}`);
  } catch (e) {
    console.log('  ❌ 应该返回幂等结果，而非错误:', e);
  }
  
  section('6. 查询历史记录');
  
  console.log('\n[餐券历史] 张三餐券状态流转:');
  const vHistory = await services.getVoucher(voucher.id);
  vHistory.history.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.created_at}] ${h.action}: ${h.from_status || '(无)'} → ${h.to_status}`);
    console.log(`     操作人: ${h.operator}, 原因: ${h.reason || '(无)'}`);
    if (h.before_state || h.after_state) {
      console.log(`     状态差异: before=${JSON.stringify(h.before_state)} → after=${JSON.stringify(h.after_state)}`);
    }
  });
  
  section('7. 月度报告汇总');
  
  const now = new Date();
  const report = await services.getMonthlyReport(now.getFullYear(), now.getMonth() + 1);
  console.log('\n[月度报告摘要]');
  console.log(`  期间: ${report.period}`);
  console.log(`  发券数: ${report.summary.vouchers_issued}`);
  console.log(`  核销数: ${report.summary.vouchers_redeemed}`);
  console.log(`  作废物: ${report.summary.vouchers_voided}`);
  console.log(`  过期数: ${report.summary.vouchers_expired}`);
  console.log(`  发券总金额: ¥${report.summary.total_amount}`);
  console.log(`  核销总金额: ¥${report.summary.redeemed_amount}`);
  
  console.log('\n[各部门统计]:');
  report.by_department.forEach(d => {
    console.log(`  - ${d.department_name}: 发${d.issued}张/核${d.redeemed}张/作${d.voided}张, 核销额¥${d.redeemed_amount}`);
  });
  
  console.log('\n[各档口统计]:');
  report.by_stall.forEach(s => {
    console.log(`  - ${s.stall_name}: ${s.count}次, ¥${s.amount}`);
  });
  
  section('8. 最终数据验证');
  
  console.log('\n[访客用餐状态] 张三:');
  const zsStatus = await services.getVisitorMealStatus('appt-normal-001');
  console.log(`  访客: ${zsStatus.visitor_name} (${zsStatus.visitor_company})`);
  console.log(`  预约状态: ${zsStatus.appointment_status}`);
  console.log(`  餐券状态: ${zsStatus.voucher_status}`);
  console.log(`  是否已用餐: ${zsStatus.redeemed ? '✅ 已核销' : '❌ 未核销'}`);
  console.log(`  用餐档口: ${zsStatus.stall_name || '-'}`);
  
  console.log('\n[部门费用] 信息技术部:');
  const itExpense = await services.getDepartmentExpense('dept-it');
  console.log(`  总预算: ¥${itExpense.budget_total}`);
  console.log(`  已使用: ¥${itExpense.budget_used}`);
  console.log(`  剩余: ¥${itExpense.budget_remaining}`);
  console.log(`  发券: ${itExpense.summary.issued}张, 核销: ${itExpense.summary.redeemed}张`);
  
  console.log('\n[档口明细] 中式快餐档口:');
  const stallDetail = await services.getStallRedemptionDetails('stall-1');
  console.log(`  档口: ${stallDetail.stall.name}`);
  console.log(`  核销次数: ${stallDetail.total_count}`);
  console.log(`  核销金额: ¥${stallDetail.total_amount}`);
  
  console.log('\n🎉 演示完成！所有正常流程验证通过');
};

run().catch(err => {
  console.error('演示失败:', err);
  process.exit(1);
});
