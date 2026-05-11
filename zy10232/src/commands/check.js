const dataStore = require('../store/dataStore');
const Validator = require('../utils/validator');

module.exports = function(program) {
  program
    .command('check')
    .description('异常检查：档期重叠、归还未验收、污损未扣款、逾期清单')
    .option('--type <type>', '检查类型: all | overlap | uninspected | unpaid | overdue', 'all')
    .action((options) => {
      dataStore.initialize();
      const issues = Validator.checkAllIssues();
      const currentDate = new Date().toISOString().split('T')[0];

      console.log(`\n🔍 异常检查报告 (${currentDate})`);
      console.log('═'.repeat(60));

      if (options.type === 'all' || options.type === 'overlap') {
        console.log(`\n📅 档期重叠检查:`);
        if (issues.scheduleOverlaps.length === 0) {
          console.log('   ✅ 未发现档期重叠');
        } else {
          issues.scheduleOverlaps.forEach(({ garment, records }, idx) => {
            console.log(`   ${idx + 1}. ${garment.getUniqueKey()}`);
            records.forEach((r, i) => {
              console.log(`      冲突${i + 1}: ${r.department} | ${r.borrowDate}~${r.dueDate} (${r.borrower || '未指定借用人'})`);
            });
          });
        }
      }

      if (options.type === 'all' || options.type === 'uninspected') {
        console.log(`\n🔬 归还未验收检查:`);
        if (issues.uninspectedReturns.length === 0) {
          console.log('   ✅ 所有归还记录已验收');
        } else {
          issues.uninspectedReturns.forEach((r, idx) => {
            console.log(`   ${idx + 1}. ${r.garmentInfo.styleNo}-${r.garmentInfo.size}-${r.garmentInfo.color}`);
            console.log(`      部门: ${r.department} | 归还日期: ${r.returnDate || '未记录'}`);
            console.log(`      建议: 请尽快完成验收检查`);
          });
        }
      }

      if (options.type === 'all' || options.type === 'unpaid') {
        console.log(`\n💰 污损未扣款检查:`);
        if (issues.unpaidDamages.length === 0) {
          console.log('   ✅ 无未处理的污损记录');
        } else {
          issues.unpaidDamages.forEach((r, idx) => {
            console.log(`   ${idx + 1}. ${r.garmentInfo.styleNo}-${r.garmentInfo.size}-${r.garmentInfo.color}`);
            console.log(`      部门: ${r.department} | 污损说明: ${r.damageDescription}`);
            console.log(`      赔付金额: ¥${r.compensationAmount} | 状态: ${r.compensationStatus}`);
          });
        }
      }

      if (options.type === 'all' || options.type === 'overdue') {
        console.log(`\n⏰ 逾期清单检查:`);
        if (issues.overdueRecords.length === 0) {
          console.log('   ✅ 无逾期未归还记录');
        } else {
          issues.overdueRecords.forEach((r, idx) => {
            const dueDays = Math.floor((new Date(currentDate) - new Date(r.dueDate)) / (1000 * 60 * 60 * 24));
            console.log(`   ${idx + 1}. ${r.garmentInfo.styleNo}-${r.garmentInfo.size}-${r.garmentInfo.color}`);
            console.log(`      部门: ${r.department} | 借用人: ${r.borrower || '未指定'}`);
            console.log(`      应还日期: ${r.dueDate} | 已逾期 ${dueDays} 天`);
          });
        }
      }

      const totalIssues = issues.scheduleOverlaps.length + 
                         issues.uninspectedReturns.length + 
                         issues.unpaidDamages.length + 
                         issues.overdueRecords.length;

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📊 问题汇总: ${totalIssues} 项待处理`);
      if (totalIssues > 0) {
        console.log(`   建议: 请使用 "garment correct" 或 "garment confirm" 命令进行处理`);
      }
    });

  program
    .command('check-schedule')
    .description('检查特定样衣的档期占用情况')
    .requiredOption('--style <styleNo>', '款号')
    .requiredOption('--size <size>', '尺码')
    .requiredOption('--color <color>', '颜色')
    .option('--borrow <date>', '拟借用日期 (YYYY-MM-DD)')
    .option('--due <date>', '拟归还日期 (YYYY-MM-DD)')
    .action((options) => {
      dataStore.initialize();
      
      const garment = dataStore.getGarmentByKey(options.style, options.size, options.color);
      if (!garment) {
        console.log(`⚠️  未找到样衣: ${options.style}-${options.size}-${options.color}`);
        console.log('   该样衣尚无借用记录，可正常使用');
        return;
      }

      const records = dataStore.getRecordsByGarmentId(garment.id);
      const activeRecords = records.filter(r => r.returnStatus !== 'returned');
      const currentDate = new Date().toISOString().split('T')[0];

      console.log(`\n📅 档期查询: ${garment.getUniqueKey()}`);
      console.log('─'.repeat(60));
      console.log(`当前状态: ${garment.status}`);
      console.log(`\n已占用档期 (${activeRecords.length} 条):`);
      
      if (activeRecords.length === 0) {
        console.log('   暂无占用');
      } else {
        activeRecords
          .sort((a, b) => a.borrowDate.localeCompare(b.borrowDate))
          .forEach((r, idx) => {
            const status = r.dueDate < currentDate ? '🔴 逾期' : '🟡 使用中';
            console.log(`   ${idx + 1}. ${status} ${r.borrowDate} ~ ${r.dueDate}`);
            console.log(`      ${r.department} | ${r.borrower || '未指定借用人'}`);
          });
      }

      if (options.borrow && options.due) {
        console.log(`\n📋 拟借用: ${options.borrow} ~ ${options.due}`);
        const overlaps = Validator.checkScheduleOverlap(garment.id, options.borrow, options.due);
        
        if (overlaps.length === 0) {
          console.log('   ✅ 档期可用，可以借出');
        } else {
          console.log(`   ❌ 档期冲突! 与 ${overlaps.length} 条记录重叠:`);
          overlaps.forEach((r, i) => {
            console.log(`      ${i + 1}. ${r.borrowDate} ~ ${r.dueDate} (${r.department})`);
          });
        }
      }
    });
};
