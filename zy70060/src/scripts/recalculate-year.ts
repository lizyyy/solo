import { initDatabase } from '../config/database';
import { customerService } from '../services/customer-service';
import { quotaLedgerService } from '../services/quota-ledger-service';
import { reportingService } from '../services/reporting-service';

const runRecalculate = async () => {
  const args = process.argv.slice(2);
  const year = args[0] ? parseInt(args[0]) : new Date().getFullYear();

  console.log(`开始重算 ${year} 年度额度...`);
  await initDatabase();

  console.log('\n--- 获取所有客户 ---');
  const customers = await customerService.getAllCustomers(1000);
  console.log(`找到 ${customers.length} 位客户`);

  console.log(`\n--- 重算 ${year} 年度额度 ---`);
  const results = [];

  for (const customer of customers) {
    console.log(`\n处理客户: ${customer.name}`);
    
    try {
      const ledger = await quotaLedgerService.recalculateQuota(customer.id, year);
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        totalQuota: ledger.totalQuota,
        usedQuota: ledger.usedQuota,
        availableQuota: ledger.availableQuota
      });
      
      console.log(`  总额度: ${ledger.totalQuota}`);
      console.log(`  已使用: ${ledger.usedQuota}`);
      console.log(`  可用额度: ${ledger.availableQuota}`);
    } catch (error: any) {
      console.error(`  ❌ 重算失败: ${error.message}`);
    }
  }

  console.log(`\n--- 生成 ${year} 年月度报表 ---`);
  const currentMonth = new Date().getMonth() + 1;
  try {
    const monthlyReports = await reportingService.generateMonthlyReport(year, currentMonth);
    console.log(`生成 ${year} 年 ${currentMonth} 月报表 ${monthlyReports.length} 份`);
  } catch (error: any) {
    console.error(`生成月报失败: ${error.message}`);
  }

  console.log('\n--- 汇总统计 ---');
  const totalUsed = results.reduce((sum, r) => sum + r.usedQuota, 0);
  const totalAvailable = results.reduce((sum, r) => sum + r.availableQuota, 0);
  
  console.log(`客户总数: ${results.length}`);
  console.log(`累计已用额度: ${totalUsed.toFixed(2)} 元`);
  console.log(`累计可用额度: ${totalAvailable.toFixed(2)} 元`);

  console.log('\n✅ 年度额度重算完成!');
  console.log('\n下一步操作:');
  console.log('  1. 检查具体客户: curl http://localhost:3000/api/quota/<客户ID>');
  console.log('  2. 查看监管报表: curl http://localhost:3000/api/reports/daily/YYYY-MM-DD');
  console.log('  3. 导出监管数据: curl http://localhost:3000/api/reports/export/YYYY-MM-DD');
};

runRecalculate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('年度重算失败:', error);
    process.exit(1);
  });