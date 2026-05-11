const dataStore = require('../store/dataStore');
const Validator = require('../utils/validator');

module.exports = function(program) {
  program
    .command('borrow')
    .description('手动登记样衣借出')
    .requiredOption('--style <styleNo>', '款号')
    .requiredOption('--size <size>', '尺码')
    .requiredOption('--color <color>', '颜色')
    .requiredOption('--department <dept>', '借用部门')
    .option('--borrower <name>', '借用人')
    .option('--borrow-date <date>', '借用日期 (YYYY-MM-DD)，默认为今天')
    .requiredOption('--due-date <date>', '预计归还日期 (YYYY-MM-DD)')
    .option('--notes <text>', '备注')
    .option('--force', '强制借出（忽略档期冲突和未验收检查）', false)
    .action((options) => {
      dataStore.initialize();

      const borrowDate = options.borrowDate || new Date().toISOString().split('T')[0];
      
      if (!Validator.isValidDate(borrowDate) || !Validator.isValidDate(options.dueDate)) {
        console.error('错误: 日期格式无效，请使用 YYYY-MM-DD 格式');
        process.exit(1);
      }

      let garment = dataStore.getGarmentByKey(options.style, options.size, options.color);
      
      if (!garment) {
        garment = dataStore.addGarment({
          styleNo: options.style,
          size: options.size,
          color: options.color,
          status: 'available'
        });
        console.log(`📦 自动创建样衣: ${garment.getUniqueKey()}`);
      }

      if (!options.force) {
        const overlaps = Validator.checkScheduleOverlap(garment.id, borrowDate, options.dueDate);
        if (overlaps.length > 0) {
          console.error(`❌ 档期冲突! 与 ${overlaps.length} 条记录重叠:`);
          overlaps.forEach((r, i) => {
            console.error(`   ${i + 1}. ${r.borrowDate} ~ ${r.dueDate} (${r.department})`);
          });
          console.error('\n如需强制借出，请使用 --force 参数');
          process.exit(1);
        }

        const uninspected = Validator.checkUninspectedReturn(garment.id);
        if (uninspected) {
          console.error(`❌ 该样衣存在未验收的归还记录:`);
          console.error(`   归还日期: ${uninspected.returnDate || '未记录'}`);
          console.error(`   借用部门: ${uninspected.department}`);
          console.error(`\n请先完成验收，或使用 --force 参数强制借出`);
          process.exit(1);
        }
      }

      const record = dataStore.addRecord({
        garmentId: garment.id,
        garmentInfo: {
          styleNo: garment.styleNo,
          size: garment.size,
          color: garment.color
        },
        department: options.department,
        borrower: options.borrower || '',
        borrowDate,
        dueDate: options.dueDate,
        returnStatus: 'pending',
        inspectionStatus: 'not_inspected',
        source: 'manual',
        notes: options.notes || ''
      });

      dataStore.updateGarment(garment.id, { status: 'borrowed' });

      console.log(`\n✅ 借出登记成功`);
      console.log('─'.repeat(40));
      console.log(`  样衣:     ${garment.getUniqueKey()}`);
      console.log(`  部门:     ${options.department}`);
      console.log(`  借用人:   ${options.borrower || '未指定'}`);
      console.log(`  借用日期: ${borrowDate}`);
      console.log(`  预计归还: ${options.dueDate}`);
      console.log(`  记录ID:   ${record.id}`);
    });

  program
    .command('return')
    .description('登记样衣归还（需验收）')
    .requiredOption('--record <recordId>', '借用记录ID')
    .option('--return-date <date>', '归还日期 (YYYY-MM-DD)，默认为今天')
    .option('--status <status>', '归还状态: returned | partial | lost', 'returned')
    .option('--damage <description>', '污损说明')
    .option('--compensation <amount>', '赔付金额')
    .option('--comp-status <status>', '赔付状态: not_needed | pending | paid', 'not_needed')
    .option('--inspection <status>', '验收状态: not_inspected | passed | failed', 'not_inspected')
    .option('--notes <text>', '备注')
    .action((options) => {
      dataStore.initialize();

      const record = dataStore.getRecordById(options.record);
      if (!record) {
        console.error(`错误: 未找到记录 ID: ${options.record}`);
        console.error('请先使用 garment list 或 garment schedule 查找记录ID');
        process.exit(1);
      }

      if (record.returnStatus !== 'pending') {
        console.error(`错误: 该记录已归还 (状态: ${record.returnStatus})`);
        process.exit(1);
      }

      const returnDate = options.returnDate || new Date().toISOString().split('T')[0];
      if (!Validator.isValidDate(returnDate)) {
        console.error('错误: 归还日期格式无效');
        process.exit(1);
      }

      const compensationAmount = options.compensation ? parseFloat(options.compensation) : 0;
      let compensationStatus = options.compStatus;
      
      if (options.damage && compensationAmount > 0 && compensationStatus === 'not_needed') {
        compensationStatus = 'pending';
      }

      const updates = {
        returnDate,
        returnStatus: options.status,
        inspectionStatus: options.inspection,
        damageDescription: options.damage || record.damageDescription,
        compensationAmount: compensationAmount || record.compensationAmount,
        compensationStatus,
        notes: options.notes || record.notes
      };

      const updatedRecord = dataStore.updateRecord(record.id, updates);

      if (options.inspection === 'passed') {
        dataStore.updateGarment(record.garmentId, { status: 'available' });
      } else if (options.damage || options.inspection === 'failed') {
        dataStore.updateGarment(record.garmentId, { status: 'damaged' });
      }

      console.log(`\n✅ 归还登记成功`);
      console.log('─'.repeat(40));
      console.log(`  样衣:     ${record.garmentInfo.styleNo}-${record.garmentInfo.size}-${record.garmentInfo.color}`);
      console.log(`  部门:     ${record.department}`);
      console.log(`  归还日期: ${returnDate}`);
      console.log(`  归还状态: ${options.status}`);
      console.log(`  验收状态: ${options.inspection}`);
      
      if (options.damage) {
        console.log(`  污损说明: ${options.damage}`);
        console.log(`  赔付金额: ¥${compensationAmount}`);
        console.log(`  赔付状态: ${compensationStatus}`);
      }

      if (options.inspection === 'not_inspected') {
        console.log(`\n⚠️  提醒: 该归还记录尚未验收，请尽快处理`);
        console.log(`   使用 garment inspect --record ${record.id} 完成验收`);
      }
    });

  program
    .command('inspect')
    .description('归还验收检查')
    .requiredOption('--record <recordId>', '借用记录ID')
    .requiredOption('--status <status>', '验收状态: passed | failed')
    .option('--damage <description>', '污损说明')
    .option('--compensation <amount>', '赔付金额')
    .option('--comp-status <status>', '赔付状态: pending | paid', 'pending')
    .option('--notes <text>', '备注')
    .action((options) => {
      dataStore.initialize();

      const record = dataStore.getRecordById(options.record);
      if (!record) {
        console.error(`错误: 未找到记录 ID: ${options.record}`);
        process.exit(1);
      }

      if (record.returnStatus === 'pending') {
        console.error('错误: 该记录尚未归还，无法验收');
        console.error('请先使用 garment return 登记归还');
        process.exit(1);
      }

      if (record.inspectionStatus !== 'not_inspected') {
        console.error(`错误: 该记录已验收 (状态: ${record.inspectionStatus})`);
        process.exit(1);
      }

      const compensationAmount = options.compensation ? parseFloat(options.compensation) : record.compensationAmount;
      const compensationStatus = options.damage || compensationAmount > 0 ? options.compStatus : 'not_needed';

      const updates = {
        inspectionStatus: options.status,
        damageDescription: options.damage || record.damageDescription,
        compensationAmount,
        compensationStatus,
        notes: options.notes || record.notes
      };

      dataStore.updateRecord(record.id, updates);

      if (options.status === 'passed') {
        dataStore.updateGarment(record.garmentId, { status: 'available' });
      } else {
        dataStore.updateGarment(record.garmentId, { status: 'damaged' });
      }

      console.log(`\n✅ 验收完成`);
      console.log('─'.repeat(40));
      console.log(`  样衣:     ${record.garmentInfo.styleNo}-${record.garmentInfo.size}-${record.garmentInfo.color}`);
      console.log(`  验收结果: ${options.status === 'passed' ? '✅ 通过' : '❌ 未通过'}`);
      
      if (options.damage || compensationAmount > 0) {
        console.log(`  污损说明: ${options.damage || record.damageDescription || '无'}`);
        console.log(`  赔付金额: ¥${compensationAmount}`);
        console.log(`  赔付状态: ${compensationStatus}`);
      }
    });
};
