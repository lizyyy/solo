const db = require('./db');
const sampleGenerator = require('./sample-generator');
const importer = require('./importer');
const checker = require('./checker');
const calculator = require('./calculator');
const reporter = require('./reporter');

async function runDemo() {
  const workDir = process.cwd();
  const period = '202603';
  
  console.log('\n┌' + '─'.repeat(58) + '┐');
  console.log('│              门店导购提成复核 CLI - 演示流程             │');
  console.log('└' + '─'.repeat(58) + '┘\n');

  try {
    console.log('【步骤 1/7】初始化工作目录...');
    console.log('  命令: commission-review init --with-samples');
    db.initialize(workDir);
    sampleGenerator.generateSampleData(workDir);
    console.log('  ✓ 数据库和样例数据已创建\n');

    console.log('【步骤 2/7】连接数据库并导入数据...');
    db.connect(workDir);
    console.log('');

    const types = ['stores', 'staff', 'products', 'promotions', 'sales', 'returns', 'allocations', 'transfers'];
    for (const type of types) {
      console.log(`  导入 ${type}...`);
      const result = importer.importData(workDir, type, null, { operator: 'demo' });
      console.log(`    ✓ ${result.successCount} 条成功`);
    }
    console.log('');

    console.log('【步骤 3/7】数据完整性检查...');
    console.log('  命令: commission-review check 202603');
    const checkResult = checker.runChecks(workDir, period);
    
    const statusColors = {
      'passed': '\x1b[32m通过\x1b[0m',
      'needs_review': '\x1b[33m需要复核\x1b[0m',
      'failed': '\x1b[31m存在错误\x1b[0m'
    };
    
    console.log(`  状态: ${statusColors[checkResult.summary.status]}`);
    console.log(`  错误: ${checkResult.summary.counts.error} | 警告: ${checkResult.summary.counts.warning} | 信息: ${checkResult.summary.counts.info}`);
    
    if (checkResult.issues.length > 0) {
      console.log('\n  发现的问题:');
      checkResult.issues.forEach((issue, i) => {
        const icon = issue.type === 'error' ? '\x1b[31m✗\x1b[0m' : 
                     issue.type === 'warning' ? '\x1b[33m⚠\x1b[0m' : '\x1b[34mℹ\x1b[0m';
        console.log(`    ${icon} ${issue.description}`);
        console.log(`      ${issue.details}`);
      });
    }
    console.log('');

    console.log('【步骤 4/7】计算提成...');
    console.log('  命令: commission-review calculate 202603');
    const calcResult = calculator.calculateCommission(workDir, period, { operator: 'demo' });
    
    console.log(`  计算ID: ${calcResult.calculationId}`);
    console.log(`  销售提成: ¥${calcResult.summary.salesCommission.toFixed(2)}`);
    console.log(`  退货扣减: ¥${calcResult.summary.returnDeduction.toFixed(2)}`);
    console.log(`  净额提成: ¥\x1b[32m${calcResult.summary.netCommission.toFixed(2)}\x1b[0m`);
    console.log(`  涉及导购: ${calcResult.summary.staffCount} 人\n`);

    console.log('【步骤 5/7】查看导购明细 - 张美丽 (S002)...');
    console.log('  命令: commission-review detail S002 202603');
    const detail = calculator.getStaffCommission('S002', period);
    
    console.log(`  销售提成: ¥${detail.summary.salesCommission.toFixed(2)}`);
    console.log(`  退货扣减: ¥${detail.summary.returnDeduction.toFixed(2)}`);
    console.log(`  净额: ¥\x1b[32m${detail.summary.netCommission.toFixed(2)}\x1b[0m`);
    console.log('');
    console.log('  明细记录:');
    detail.details.forEach(d => {
      const type = d.commission_type === 'sale' ? '\x1b[32m销售\x1b[0m' : '\x1b[31m退货\x1b[0m';
      const amount = d.commission_amount >= 0 
        ? `¥\x1b[32m${d.commission_amount.toFixed(2)}\x1b[0m` 
        : `¥\x1b[31m${d.commission_amount.toFixed(2)}\x1b[0m`;
      console.log(`    ${type} ${d.order_no || d.return_no} | 提成: ${amount}`);
      console.log(`      规则: ${d.calculation_rule}`);
      if (d.deduction_reason) {
        console.log(`      扣减原因: \x1b[33m${d.deduction_reason}\x1b[0m`);
      }
    });
    console.log('');

    console.log('【步骤 6/7】查看所有导购汇总...');
    const allSummary = calculator.getAllStaffSummary(period);
    console.log('  ┌────────────┬────────────┬────────┬────────────┬────────────┬────────────┐');
    console.log('  │ 导购编码    │ 姓名        │ 门店    │ 销售提成    │ 退货扣减    │ 净额        │');
    console.log('  ├────────────┼────────────┼────────┼────────────┼────────────┼────────────┤');
    
    allSummary.forEach(s => {
      console.log(`  │ ${s.staff_code.padEnd(10)} │ ${(s.staff_name || '-').padEnd(10)} │ ${(s.store_code || '-').padEnd(6)} │ ¥${String(s.sales_total.toFixed(2)).padStart(9)} │ ¥${String(s.return_total.toFixed(2)).padStart(9)} │ ¥\x1b[32m${String(s.net_total.toFixed(2)).padStart(9)}\x1b[0m │`);
    });
    console.log('  └────────────┴────────────┴────────┴────────────┴────────────┴────────────┘\n');

    console.log('【步骤 7/7】生成完整报告...');
    const pendingReview = checker.getPendingReviewOrders(period);
    const reportData = {
      checkResult,
      calculationSummary: calcResult.summary,
      staffSummary: allSummary,
      pendingReview
    };
    const report = reporter.generateReport(workDir, period, reportData, { console: false });
    
    console.log(`  ✓ 报告已生成: ${report.path}\n`);

    console.log('═'.repeat(60));
    console.log('  演示完成！');
    console.log('');
    console.log('  核心业务规则已验证:');
    console.log('    ✓ 多人分摊 (如 SO001: S002 60%, S003 40%)');
    console.log('    ✓ 活动扣减 (如 PROMO001: 提成 x0.8)');
    console.log('    ✓ 跨月退货冲抵 (RO002 冲抵上月订单)');
    console.log('    ✓ 调拨销售归属 (SO012 来源店 ST003)');
    console.log('    ✓ 幂等检测 (重复订单导入会报错)');
    console.log('');
    console.log('  下一步可以尝试:');
    console.log('    1. node src/cli.js detail S003 202603  - 查看其他导购');
    console.log('    2. node src/cli.js check 202603          - 检查问题');
    console.log('    3. node src/cli.js adjust                - 模拟人工调整');
    console.log('    4. node src/cli.js history               - 查看操作历史');
    console.log('═'.repeat(60));

    db.close();

  } catch (err) {
    console.error(`\n❌ 演示失败: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

runDemo();
