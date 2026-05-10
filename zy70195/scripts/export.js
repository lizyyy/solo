const db = require('../src/database');
const exportService = require('../src/services/export-service');
const path = require('path');

async function runExport() {
  console.log('========================================');
  console.log('   导出业务复核数据');
  console.log('========================================');
  console.log('');
  
  await db.init();
  
  console.log('正在导出完整复核数据...');
  const result = await exportService.exportFullReview();
  
  console.log('');
  console.log('导出完成！');
  console.log('');
  console.log('生成的文件:');
  console.log('  - 复核汇总:        exports/' + path.basename(result.summary_file));
  console.log('  - 资质复核:        exports/' + result.files.qualifications);
  console.log('  - 冻结记录复核:    exports/' + result.files.freeze_logs);
  console.log('  - 订单复核:        exports/' + result.files.orders);
  console.log('  - 风险清单复核:    exports/' + result.files.risks);
  console.log('  - 异常记录复核:    exports/' + result.files.exceptions);
  console.log('');
  
  console.log('数据摘要:');
  console.log('  生成时间:', result.summary.generated_at);
  console.log('');
  console.log('  资质情况:');
  console.log('    总计:', result.summary.qualifications.total, '条');
  console.log('    已过期:', result.summary.qualifications.expired, '条');
  console.log('    30天内到期:', result.summary.qualifications.warning_30, '条');
  console.log('    90天内到期:', result.summary.qualifications.warning_90, '条');
  console.log('    正常:', result.summary.qualifications.normal, '条');
  console.log('');
  console.log('  订单情况:');
  console.log('    总订单数:', result.summary.orders.total_orders);
  console.log('    总金额:', result.summary.orders.total_amount, '元');
  console.log('    拦截/冻结金额:', result.summary.orders.blocked_frozen_amount, '元');
  console.log('');
  console.log('  风险情况:');
  console.log('    总计:', result.summary.risks.total, '条');
  console.log('    活跃风险:', result.summary.risks.active, '条');
  console.log('');
  console.log('  异常情况:');
  console.log('    总计:', result.summary.exceptions.total, '条');
  console.log('    待处理:', result.summary.exceptions.pending, '条');
  console.log('');
  console.log('请打开 exports 文件夹查看 CSV 文件，可用 Excel 打开进行业务复核');
  
  process.exit(0);
}

runExport().catch(err => {
  console.error('导出失败:', err);
  process.exit(1);
});
