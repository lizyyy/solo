const { initDB, getDB } = require('../src/database/connection');
const partsService = require('../src/services/partsService');
const engineersService = require('../src/services/engineersService');
const workOrdersService = require('../src/services/workOrdersService');
const loanService = require('../src/services/loanService');
const reportService = require('../src/services/reportService');
const dayjs = require('dayjs');

function printLine(char = '=', length = 80) {
  console.log(char.repeat(length));
}

function printSection(title) {
  console.log();
  printLine();
  console.log(`  ${title}`);
  printLine('-');
}

function simulateOverdue(loanId, days = 10) {
  const db = getDB();
  const newDate = dayjs().subtract(days, 'day').toISOString();
  db.prepare(`UPDATE loans SET borrowed_at = ?, expected_return_at = ? WHERE id = ?`)
    .run(dayjs().subtract(days, 'day').toISOString(), dayjs().subtract(3, 'day').toISOString(), loanId);
}

async function runDemo() {
  console.log('\n');
  printLine('*');
  console.log('  售后备件借用 API - 完整演示脚本');
  console.log('  本脚本将运行以下场景:');
  console.log('  1. 正常借还流程');
  console.log('  2. 工单消耗流程');
  console.log('  3. 逾期提醒流程');
  console.log('  4. 损坏赔付流程');
  console.log('  5. 重复借用验证');
  console.log('  6. 异常处理和人工修正');
  printLine('*');
  
  await initDB();
  
  const partMB = partsService.getPartByCode('MB-001');
  const partHD = partsService.getPartByCode('HD-002');
  const partRAM = partsService.getPartByCode('RAM-003');
  const partPSU = partsService.getPartByCode('PSU-004');
  const partDISP = partsService.getPartByCode('DISP-005');
  
  const engZhang = engineersService.getEngineerByCode('ENG-001');
  const engLi = engineersService.getEngineerByCode('ENG-002');
  const engWang = engineersService.getEngineerByCode('ENG-003');
  
  const wo1 = workOrdersService.getWorkOrderByCode('WO-2024-001');
  const wo2 = workOrdersService.getWorkOrderByCode('WO-2024-002');
  const wo3 = workOrdersService.getWorkOrderByCode('WO-2024-003');
  const wo4 = workOrdersService.getWorkOrderByCode('WO-2024-004');
  
  printSection('场景 1: 正常借还流程');
  console.log('张明工程师需要借用主板去客户现场维修');
  
  let loan1;
  try {
    loan1 = loanService.createLoan({
      part_id: partMB.id,
      engineer_id: engZhang.id,
      quantity: 1,
      loan_reason: '阳光科技主板维修',
      expected_return_days: 7
    }, '仓管-小王');
    
    console.log(`✓ 创建借用: ${loan1.loan_code}`);
    console.log(`  备件: ${loan1.part_name} x${loan1.quantity}`);
    console.log(`  工程师: ${loan1.engineer_name}`);
    console.log(`  状态: ${loan1.status}`);
    console.log(`  预计归还: ${loan1.expected_return_at}`);
  } catch (error) {
    console.log(`✗ 借用失败: ${error.message}`);
    process.exit(1);
  }
  
  console.log('\n2天后，工程师完成维修，归还备件');
  const afterReturn = loanService.returnPart(loan1.id, 1, '仓管-小王', '维修完成，备件完好归还');
  console.log(`✓ 归还完成`);
  console.log(`  状态: ${afterReturn.status}`);
  console.log(`  实际归还: ${afterReturn.actual_return_at}`);
  
  console.log('\n检查库存变化:');
  const partMBAfter = partsService.getPartById(partMB.id);
  console.log(`  主板库存: 借出前 50 -> 当前 ${partMBAfter.stock_quantity}`);
  
  printSection('场景 2: 工单消耗流程');
  console.log('李华工程师去星辰教育集团做系统升级，需要借用硬盘和内存');
  
  let loan2;
  try {
    loan2 = loanService.createLoan({
      part_id: partHD.id,
      engineer_id: engLi.id,
      quantity: 2,
      loan_reason: '系统升级更换硬盘',
      expected_return_days: 5,
      work_order_id: wo2.id
    }, '仓管-小王');
    
    console.log(`✓ 创建借用: ${loan2.loan_code}`);
    console.log(`  备件: ${loan2.part_name} x${loan2.quantity}`);
    console.log(`  绑定工单: ${wo2.order_code} - ${wo2.customer_name}`);
  } catch (error) {
    console.log(`✗ 借用失败: ${error.message}`);
  }
  
  console.log('\n现场发现需要全部更换旧硬盘，客户同意消耗');
  const afterConsume = loanService.consumePart(loan2.id, 2, '仓管-小王', '客户同意更换，旧硬盘报废');
  console.log(`✓ 消耗登记完成`);
  console.log(`  状态: ${afterConsume.status}`);
  console.log(`  消耗数量: ${afterConsume.totalConsumed}`);
  
  printSection('场景 3: 逾期提醒流程');
  console.log('王强工程师借用内存，忘记归还，超过期限');
  
  let loan3;
  try {
    loan3 = loanService.createLoan({
      part_id: partRAM.id,
      engineer_id: engWang.id,
      quantity: 3,
      loan_reason: '临时测试用',
      expected_return_days: 3
    }, '仓管-小王');
    
    console.log(`✓ 创建借用: ${loan3.loan_code}`);
    
    simulateOverdue(loan3.id, 10);
    console.log(`  (模拟: 借用已过去10天，超过3天归还期限)`);
    
    const overdueCount = loanService.checkOverdue();
    console.log(`✓ 检查逾期，发现 ${overdueCount} 条逾期记录`);
    
    const loan3Updated = loanService.getLoanDetail(loan3.id);
    console.log(`  状态: ${loan3Updated.status}`);
    console.log(`  逾期标志: ${loan3Updated.is_overdue}`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }
  
  printSection('场景 4: 损坏赔付流程');
  console.log('张明工程师借用电源，意外损坏');
  
  let loan4;
  try {
    loan4 = loanService.createLoan({
      part_id: partPSU.id,
      engineer_id: engZhang.id,
      quantity: 2,
      loan_reason: '蓝天医疗设备电源更换测试',
      expected_return_days: 7,
      work_order_id: wo3.id
    }, '仓管-小王');
    
    console.log(`✓ 创建借用: ${loan4.loan_code}`);
    
    console.log('\n现场测试时，其中1个电源损坏');
    const afterDamage = loanService.reportDamage(
      loan4.id, 
      1, 
      'medium',
      150,
      '仓管-小王',
      '测试过程中电压不稳导致损坏'
    );
    
    console.log(`✓ 损坏登记完成`);
    console.log(`  损坏数量: ${afterDamage.totalDamaged}`);
    console.log(`  损坏等级: medium (中等)`);
    console.log(`  赔偿金额: ¥150.00`);
    
    console.log('\n归还剩余1个好的电源');
    const afterReturn2 = loanService.returnPart(loan4.id, 1, '仓管-小王', '1个损坏，1个完好归还');
    console.log(`✓ 归还完成，状态: ${afterReturn2.status}`);
    
    console.log('\n登记赔偿支付');
    const afterCompensate = loanService.processCompensation(loan4.id, 150, '财务-小李', '工程师赔偿款已到账');
    console.log(`✓ 赔偿登记完成`);
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }
  
  printSection('场景 5: 重复借用验证');
  console.log('验证同一工程师不能重复借用同一未归还的备件');
  
  let loan5;
  try {
    loan5 = loanService.createLoan({
      part_id: partRAM.id,
      engineer_id: engWang.id,
      quantity: 1,
      loan_reason: '再借内存',
      expected_return_days: 3
    }, '仓管-小王');
    console.log(`✓ 借用成功 (这是预期之外的)`);
  } catch (error) {
    console.log(`✗ 借用被阻止 (符合预期): ${error.message}`);
  }
  
  printSection('场景 6: 异常处理和人工修正');
  console.log('演示工单关闭但备件未归还的异常');
  
  let loan6;
  try {
    loan6 = loanService.createLoan({
      part_id: partDISP.id,
      engineer_id: engLi.id,
      quantity: 1,
      loan_reason: '绿叶环保显示器测试',
      expected_return_days: 14,
      work_order_id: wo4.id
    }, '仓管-小王');
    
    console.log(`✓ 创建借用: ${loan6.loan_code}`);
    console.log(`  绑定工单: ${wo4.order_code}`);
    
    console.log('\n工单已关闭，但备件未归还');
    workOrdersService.closeWorkOrder(wo4.id, '系统管理员', '客户反馈问题已解决');
    
    const affected = loanService.checkWorkOrderClosed();
    console.log(`✓ 检查工单关闭异常，影响 ${affected} 条记录`);
    
    const loan6Updated = loanService.getLoanDetail(loan6.id);
    console.log(`  状态: ${loan6Updated.status} (exception 表示异常)`);
    
    console.log('\n人工介入，联系工程师，发现备件已丢失');
    const corrected = loanService.manualCorrect(
      loan6.id,
      { status: 'damaged' },
      '仓库主管-张经理',
      '工单已关闭，工程师确认备件丢失，按损坏处理'
    );
    console.log(`✓ 人工修正完成`);
    console.log(`  新状态: ${corrected.status}`);
    
    console.log('\n查看审计日志:');
    const audit = reportService.getLoanAuditReport(loan6.id);
    audit.timeline.forEach(event => {
      console.log(`  [${event.time}] ${event.action} by ${event.operator}`);
      console.log(`    原因: ${event.reason || '-'}`);
      if (event.before || event.after) {
        console.log(`    变更: ${JSON.stringify(event.before)} -> ${JSON.stringify(event.after)}`);
      }
    });
  } catch (error) {
    console.log(`✗ 失败: ${error.message}`);
  }
  
  printSection('报告导出展示 - 未归还清单');
  const unreturned = reportService.getUnreturnedSummary();
  console.log(`未归还总数: ${unreturned.total_count}`);
  console.log(`  按状态分布:`);
  Object.entries(unreturned.by_status).forEach(([status, count]) => {
    if (count > 0) console.log(`    ${status}: ${count}`);
  });
  console.log(`  未绑定工单: ${unreturned.unbound_workorder}`);
  console.log(`  工单已关闭但未归还: ${unreturned.closed_workorder_pending}`);
  console.log(`  逾期超过7天: ${unreturned.overdue_7days_plus}`);
  
  console.log('\n未归还清单明细:');
  unreturned.details.forEach(loan => {
    console.log(`  ${loan.loan_code} - ${loan.part_name} x${loan.remaining}`);
    console.log(`    工程师: ${loan.engineer_name}, 状态: ${loan.status}`);
    if (loan.is_overdue) console.log(`    逾期天数: ${loan.overdue_days}天`);
  });
  
  printSection('报告导出展示 - 库存变化记录');
  const stock = reportService.getStockStatusReport();
  console.log(`库存总价值: ¥${stock.total_value.toLocaleString()}`);
  console.log(`库存总数: ${stock.total_count} 件`);
  console.log(`低库存告警: ${stock.low_stock.length} 种`);
  
  console.log('\n各备件库存:');
  stock.details.forEach(p => {
    const status = p.stock_quantity <= p.min_stock ? '⚠️ 低库存' : '✓ 正常';
    console.log(`  ${p.part_code} - ${p.part_name}: ${p.stock_quantity} ${p.unit} ${status}`);
  });
  
  printSection('报告导出展示 - 备件流向');
  console.log('查看主板 (MB-001) 的完整流向:');
  const flow = reportService.getPartFlowReport(partMB.id);
  flow.events.forEach(event => {
    console.log(`  [${event.time}] ${event.action}`);
    if (event.loan_code) console.log(`    借用单: ${event.loan_code}, 工程师: ${event.engineer}`);
    if (event.quantity) console.log(`    数量: ${event.quantity}`);
  });
  
  printSection('报告导出展示 - 完整审计记录');
  const fullAudit = reportService.getFullAuditReport();
  console.log(`审计记录总数: ${fullAudit.total_count}`);
  console.log(`按动作分布:`);
  Object.entries(fullAudit.by_action).forEach(([action, count]) => {
    console.log(`  ${action}: ${count}`);
  });
  console.log(`按操作员分布:`);
  Object.entries(fullAudit.by_operator).forEach(([op, count]) => {
    console.log(`  ${op}: ${count}`);
  });
  
  printSection('系统统计');
  const stats = reportService.getStatistics();
  console.log(`备件种类: ${stats.part_count}`);
  console.log(`活跃工程师: ${stats.active_engineer_count}`);
  console.log(`未结工单: ${stats.open_workorder_count}`);
  console.log();
  console.log(`借用状态统计:`);
  console.log(`  借用中: ${stats.borrowed_count}`);
  console.log(`  已逾期: ${stats.overdue_count}`);
  console.log(`  部分归还: ${stats.partial_count}`);
  console.log(`  异常状态: ${stats.exception_count}`);
  console.log(`  已归还: ${stats.returned_count}`);
  console.log(`  已消耗: ${stats.consumed_count}`);
  console.log(`  已损坏: ${stats.damaged_count}`);
  
  console.log();
  printLine('*');
  console.log('  演示完成！');
  console.log();
  console.log('  请通过以下报告验证业务闭环:');
  console.log('  1. GET /api/reports/unreturned - 查看未归还清单');
  console.log('  2. GET /api/reports/dashboard - 查看系统概览');
  console.log('  3. GET /api/reports/full-audit - 查看完整审计记录');
  console.log('  4. GET /api/loans/:id/audit - 查看单个借用的审计轨迹');
  printLine('*');
}

runDemo().catch(console.error);
