const storage = require('../services/storage');
const validator = require('../services/validator');
const analyzer = require('../services/analyzer');

module.exports = {
  name: 'confirm',
  description: '确认并保存复盘结果',
  execute(args) {
    if (args.length < 1) {
      console.error('使用方法: canteen-review confirm <date>');
      process.exit(1);
    }
    
    const date = args[0];
    
    console.log(`\n=== 确认复盘: ${date} ===\n`);
    
    if (storage.isDateConfirmed(date)) {
      console.error(`错误: 日期 ${date} 已存在确认记录，不能重复确认。`);
      console.log('如需查看已确认的记录，请运行:');
      console.log(`  canteen-review query ${date}`);
      console.log();
      process.exit(1);
    }
    
    const pending = storage.getPending(date);
    if (!pending) {
      console.error(`错误: 日期 ${date} 没有待处理数据`);
      console.log('请先运行: canteen-review import <file>');
      console.log();
      process.exit(1);
    }
    
    const validation = validator.validateAll(pending.data);
    if (!validation.isValid) {
      console.error('数据验证失败，无法确认:');
      validation.errors.forEach(err => console.error(`  ❌ ${err}`));
      console.log();
      process.exit(1);
    }
    
    const review = analyzer.analyze(date, pending.data);
    
    try {
      const record = storage.saveConfirmed(date, review);
      
      console.log('✅ 复盘确认成功!');
      console.log(`   保存路径: ${storage.getConfirmedPath(date)}\n`);
      
      console.log('--- 汇总信息 ---');
      const s = record.review.summary;
      console.log(`  总预约人数: ${s.totalReservation}`);
      console.log(`  实际取餐人数: ${s.totalActual}`);
      console.log(`  有效预约人数: ${s.effectiveReservation}`);
      console.log(`  剩菜重量: ${s.leftoverWeight} kg`);
      console.log(`  剩菜成本: ¥${s.leftoverCost}`);
      console.log(`  到岗率: ${s.attendanceRate}`);
      console.log();
      
      if (record.review.suggestions.length > 0) {
        console.log('--- 采购建议 ---');
        record.review.suggestions.forEach(sug => console.log(`  💡 ${sug}`));
        console.log();
      }
      
      console.log('确认时间:', record.confirmedAt);
      console.log();
      
      console.log('可用操作:');
      console.log(`  canteen-review query ${date}  - 查询详细记录`);
      console.log(`  canteen-review export ${date} - 导出数据`);
      console.log();
    } catch (error) {
      console.error(`确认失败: ${error.message}`);
      console.log();
      process.exit(1);
    }
  }
};
