const storage = require('../services/storage');
const validator = require('../services/validator');
const analyzer = require('../services/analyzer');

module.exports = {
  name: 'check',
  description: '检查指定日期的数据',
  execute(args) {
    if (args.length < 1) {
      console.error('使用方法: canteen-review check <date>');
      process.exit(1);
    }
    
    const date = args[0];
    
    console.log(`\n=== 检查数据: ${date} ===\n`);
    
    const pending = storage.getPending(date);
    
    if (!pending) {
      console.error(`错误: 日期 ${date} 没有待处理数据`);
      console.log('请先运行: canteen-review import <file>');
      console.log();
      process.exit(1);
    }
    
    const validation = validator.validateAll(pending.data);
    
    if (!validation.isValid) {
      console.error('数据验证失败:');
      validation.errors.forEach(err => console.error(`  ❌ ${err}`));
      console.log();
      process.exit(1);
    }
    
    console.log('✅ 数据验证通过\n');
    
    if (validation.hasWarnings) {
      console.log('⚠️  警告信息 (可继续确认):');
      validation.warnings.forEach(w => {
        console.log(`   ${w.message}`);
      });
      console.log();
    }
    
    const review = analyzer.analyze(date, pending.data);
    
    console.log('--- 汇总信息 ---');
    const s = review.summary;
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
    
    if (review.analysis.length > 0) {
      console.log('--- 分析结果 ---');
      review.analysis.forEach(a => console.log(`  🔍 ${a}`));
      console.log();
    }
    
    if (review.suggestions.length > 0) {
      console.log('--- 采购建议 ---');
      review.suggestions.forEach(s => console.log(`  💡 ${s}`));
      console.log();
    }
    
    console.log('确认后将保存以上结果。');
    console.log();
    console.log('下一步操作:');
    console.log(`  canteen-review confirm ${date}`);
    console.log();
  }
};
