const storage = require('../services/storage');

module.exports = {
  name: 'query',
  description: '查询已确认的复盘记录',
  execute(args) {
    if (args.length < 1) {
      console.error('使用方法: canteen-review query <date>');
      process.exit(1);
    }
    
    const date = args[0];
    
    console.log(`\n=== 查询记录: ${date} ===\n`);
    
    const record = storage.getConfirmed(date);
    
    if (!record) {
      console.error(`错误: 日期 ${date} 没有确认记录`);
      console.log();
      process.exit(1);
    }
    
    console.log('确认时间:', record.confirmedAt);
    console.log();
    
    console.log('--- 汇总信息 ---');
    const s = record.review.summary;
    console.log(`  总预约人数: ${s.totalReservation}`);
    console.log(`  实际取餐人数: ${s.totalActual}`);
    console.log(`  退餐人数: ${s.totalCancel}`);
    console.log(`  临时加餐人数: ${s.totalExtra}`);
    console.log(`  有效预约人数: ${s.effectiveReservation}`);
    console.log(`  剩菜重量: ${s.leftoverWeight} kg`);
    console.log(`  剩菜成本: ¥${s.leftoverCost}`);
    console.log(`  到岗率: ${s.attendanceRate}`);
    console.log(`  退餐率: ${s.cancelRate}`);
    console.log(`  晚退餐率: ${s.lateCancelRate}`);
    console.log();
    
    if (record.review.analysis && record.review.analysis.length > 0) {
      console.log('--- 分析结果 ---');
      record.review.analysis.forEach(a => console.log(`  🔍 ${a}`));
      console.log();
    }
    
    if (record.review.suggestions && record.review.suggestions.length > 0) {
      console.log('--- 采购建议 ---');
      record.review.suggestions.forEach(sug => console.log(`  💡 ${sug}`));
      console.log();
    }
    
    console.log('--- 原始数据摘要 ---');
    const d = record.data;
    console.log(`  预约记录: ${(d.reservation || []).length} 条`);
    console.log(`  实际取餐记录: ${(d.actual || []).length} 条`);
    console.log(`  退餐记录: ${(d.cancel || []).length} 条`);
    console.log(`  临时加餐记录: ${(d.extra || []).length} 条`);
    console.log(`  剩菜记录: ${(d.leftover || []).length} 条`);
    console.log(`  成本记录: ${(d.cost || []).length} 条`);
    console.log();
  }
};
