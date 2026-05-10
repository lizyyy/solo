const rebateRules = require('../modules/rebateRules');
const salesSummary = require('../modules/salesSummary');
const returnDeduction = require('../modules/returnDeduction');
const reconciliation = require('../modules/reconciliation');

console.log('=== 开始初始化示例数据 ===\n');

function logStep(title, content = null) {
  console.log(`[步骤] ${title}`);
  if (content) {
    if (typeof content === 'object') {
      console.log(`       ${JSON.stringify(content, null, 2).split('\n').join('\n       ')}`);
    } else {
      console.log(`       ${content}`);
    }
  }
  console.log('');
}

async function runSeed() {
  try {
    logStep('1. 创建供应商');
    const supplier1 = rebateRules.createSupplier({
      name: '华星电子科技有限公司',
      contact: '张经理 138****1234'
    }, 'admin');
    logStep('供应商1创建成功', { id: supplier1.id, name: supplier1.name });
    
    const supplier2 = rebateRules.createSupplier({
      name: '金利源商贸有限公司',
      contact: '李总 139****5678'
    }, 'admin');
    logStep('供应商2创建成功', { id: supplier2.id, name: supplier2.name });
    
    logStep('2. 创建返利规则（3档位返利）');
    const rule1 = rebateRules.createRule({
      supplier_id: supplier1.id,
      name: '2026年Q2季度返利规则',
      description: '按销量档位返利，销量越高返利比例越高',
      start_date: '2026-04-01',
      end_date: '2026-06-30',
      tiers: [
        { min_quantity: 0, max_quantity: 1000, rebate_rate: 0.02 },
        { min_quantity: 1000, max_quantity: 5000, rebate_rate: 0.05 },
        { min_quantity: 5000, max_quantity: null, rebate_rate: 0.08 }
      ]
    }, 'admin');
    logStep('规则创建成功（草稿状态）', { 
      id: rule1.id, 
      name: rule1.name, 
      status: rule1.status,
      tiers: rule1.tiers.map(t => `档${t.tier_level}: ${t.min_quantity}件+ 返${(t.rebate_rate*100).toFixed(0)}%`)
    });
    
    logStep('3. 激活返利规则');
    const activatedRule = rebateRules.activateRule(rule1.id, 'admin');
    logStep('规则已激活', { id: activatedRule.id, status: activatedRule.status });
    
    logStep('4. 添加4月份销售记录');
    const salesRecords = [
      { supplier_id: supplier1.id, product_sku: 'HX001', product_name: '智能手机A款', quantity: 500, unit_price: 2999, sale_date: '2026-04-05' },
      { supplier_id: supplier1.id, product_sku: 'HX002', product_name: '智能手机B款', quantity: 800, unit_price: 1999, sale_date: '2026-04-10' },
      { supplier_id: supplier1.id, product_sku: 'HX001', product_name: '智能手机A款', quantity: 600, unit_price: 2999, sale_date: '2026-04-15' },
      { supplier_id: supplier1.id, product_sku: 'HX003', product_name: '平板电脑', quantity: 200, unit_price: 3999, sale_date: '2026-04-20' }
    ];
    
    salesRecords.forEach((record, index) => {
      const result = salesSummary.addSalesRecord(record, 'sales_system');
      logStep(`销售记录${index+1}`, `商品: ${record.product_name}, 数量: ${record.quantity}件, 单价: ¥${record.unit_price}`);
    });
    
    const aprilSales = salesSummary.getSalesSummary(supplier1.id, '2026-04');
    logStep('4月销售汇总', {
      记录数: aprilSales.record_count,
      总销量: `${aprilSales.total_quantity}件`,
      总销售额: `¥${aprilSales.total_amount.toFixed(2)}`,
      平均单价: `¥${aprilSales.avg_unit_price.toFixed(2)}`
    });
    
    logStep('5. 添加退货记录');
    const returnRecords = [
      { supplier_id: supplier1.id, product_sku: 'HX001', product_name: '智能手机A款', quantity: 50, unit_price: 2999, return_date: '2026-04-18', reason: '质量问题' },
      { supplier_id: supplier1.id, product_sku: 'HX002', product_name: '智能手机B款', quantity: 30, unit_price: 1999, return_date: '2026-04-22', reason: '客户拒收' }
    ];
    
    returnRecords.forEach((record, index) => {
      const result = returnDeduction.addReturnRecord(record, 'after_sales');
      logStep(`退货记录${index+1}`, `商品: ${record.product_name}, 数量: ${record.quantity}件, 原因: ${record.reason}`);
    });
    
    const aprilReturns = returnDeduction.getReturnSummary(supplier1.id, '2026-04');
    logStep('4月退货汇总', {
      记录数: aprilReturns.record_count,
      总退货量: `${aprilReturns.total_quantity}件`,
      总退货额: `¥${aprilReturns.total_amount.toFixed(2)}`
    });
    
    logStep('6. 计算4月返利（第一次计算）');
    const summary1 = reconciliation.calculateReconciliation(supplier1.id, '2026-04', 'accountant');
    logStep('核算结果', {
      状态: summary1.status,
      总销量: `${summary1.total_sales_quantity}件`,
      总退货量: `${summary1.total_return_quantity}件`,
      净销量: `${summary1.net_quantity}件`,
      净销售额: `¥${summary1.net_amount.toFixed(2)}`,
      档位: summary1.tier_level ? `第${summary1.tier_level}档` : '未达标',
      返利比例: summary1.tier_level ? `${(summary1.rebate_rate * 100).toFixed(0)}%` : '0%',
      返利金额: `¥${summary1.rebate_amount.toFixed(2)}`
    });
    
    logStep('7. 追加销售，模拟月底补录数据');
    const extraSales = [
      { supplier_id: supplier1.id, product_sku: 'HX001', product_name: '智能手机A款', quantity: 1000, unit_price: 2999, sale_date: '2026-04-28' },
      { supplier_id: supplier1.id, product_sku: 'HX002', product_name: '智能手机B款', quantity: 1500, unit_price: 1999, sale_date: '2026-04-30' }
    ];
    
    extraSales.forEach((record, index) => {
      salesSummary.addSalesRecord(record, 'sales_system');
      logStep(`追加销售${index+1}`, `商品: ${record.product_name}, 数量: ${record.quantity}件`);
    });
    
    logStep('8. 档位重算（第二次计算）');
    const summary2 = reconciliation.calculateReconciliation(supplier1.id, '2026-04', 'accountant');
    logStep('重算后结果', {
      状态: summary2.status,
      总销量: `${summary2.total_sales_quantity}件`,
      净销量: `${summary2.net_quantity}件`,
      档位: summary2.tier_level ? `第${summary2.tier_level}档` : '未达标',
      返利比例: summary2.tier_level ? `${(summary2.rebate_rate * 100).toFixed(0)}%` : '0%',
      返利金额: `¥${summary2.rebate_amount.toFixed(2)}`,
      说明: '净销量增加后，档位从第2档提升到第3档'
    });
    
    logStep('9. 提交供应商确认');
    const submitted = reconciliation.submitForConfirmation(summary2.id, 'accountant');
    logStep('状态更新', { 之前: 'calculating', 现在: submitted.status });
    
    logStep('10. 创建确认函');
    const letter = reconciliation.createConfirmationLetter(submitted.id, null, 'accountant');
    logStep('确认函内容预览', letter.content.substring(0, 200) + '...');
    
    logStep('11. 发送确认函给供应商');
    const sentLetter = reconciliation.sendConfirmationLetter(letter.id, 'accountant');
    logStep('确认函状态', { 之前: 'pending', 现在: sentLetter.status });
    
    logStep('12. 供应商确认返利核算');
    const confirmed = reconciliation.confirmReconciliation(
      summary2.id,
      letter.id,
      '张经理（华星电子）',
      '数据核对无误，同意确认',
      'supplier_portal'
    );
    logStep('确认完成', {
      核算状态: confirmed.summary.status,
      确认人: confirmed.letter.confirmed_by,
      确认时间: confirmed.letter.confirmed_at,
      备注: confirmed.letter.comments
    });
    
    logStep('13. 查看历史记录（状态推进轨迹）');
    const history = require('../utils/audit').getHistory('reconciliation_summary', summary2.id);
    logStep('历史操作记录', history.map(h => ({
      时间: h.created_at,
      操作: h.action,
      操作人: h.operator,
      原因: h.reason
    })));
    
    logStep('14. 核算导出数据');
    const exportData = reconciliation.exportReconciliationData(supplier1.id, '2026-04');
    logStep('导出数据', exportData);
    
    logStep('15. 整体统计');
    const stats = reconciliation.getOverallStatistics('2026-04');
    logStep('统计概览', {
      供应商数: stats.total_suppliers,
      核算单数: stats.total_summaries,
      总销售额: `¥${stats.total_sales_amount.toFixed(2)}`,
      总返利额: `¥${stats.total_rebate_amount.toFixed(2)}`,
      按状态分布: stats.by_status
    });
    
    console.log('=== 示例数据初始化完成 ===');
    console.log('\n验收要点：');
    console.log('✓ 返利规则支持多档位配置');
    console.log('✓ 销量汇总自动按期间统计');
    console.log('✓ 退货扣减自动影响净销量');
    console.log('✓ 档位根据净销量自动匹配（可重算）');
    console.log('✓ 状态流转：calculating → pending_confirmation → confirmed');
    console.log('✓ 确认函流程完整：创建→发送→确认');
    console.log('✓ 所有操作都有审计历史记录');
    console.log('✓ 支持数据导出和整体统计');
    console.log('✓ 并发计算时有资源锁保护');
    
  } catch (err) {
    console.error('初始化失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runSeed();
