const dataStore = require('../store/dataStore');

module.exports = function(program) {
  program
    .command('correct')
    .description('人工修正借用记录（历史不覆盖，保留修改轨迹）')
    .requiredOption('--record <recordId>', '借用记录ID')
    .option('--department <dept>', '修正借用部门')
    .option('--borrower <name>', '修正借用人')
    .option('--borrow-date <date>', '修正借用日期')
    .option('--due-date <date>', '修正预计归还日期')
    .option('--return-date <date>', '修正实际归还日期')
    .option('--return-status <status>', '修正归还状态: pending | returned | partial | lost')
    .option('--inspection <status>', '修正验收状态: not_inspected | passed | failed')
    .option('--damage <description>', '修正污损说明')
    .option('--compensation <amount>', '修正赔付金额')
    .option('--comp-status <status>', '修正赔付状态: not_needed | pending | paid')
    .option('--notes <text>', '添加备注（说明修改原因）')
    .option('--reason <reason>', '修正原因说明')
    .action((options) => {
      dataStore.initialize();

      const record = dataStore.getRecordById(options.record);
      if (!record) {
        console.error(`错误: 未找到记录 ID: ${options.record}`);
        process.exit(1);
      }

      const updates = {};
      const changes = [];

      if (options.department) {
        updates.department = options.department;
        changes.push(`部门: ${record.department} → ${options.department}`);
      }
      if (options.borrower) {
        updates.borrower = options.borrower;
        changes.push(`借用人: ${record.borrower || '(空)'} → ${options.borrower}`);
      }
      if (options.borrowDate) {
        updates.borrowDate = options.borrowDate;
        changes.push(`借用日期: ${record.borrowDate} → ${options.borrowDate}`);
      }
      if (options.dueDate) {
        updates.dueDate = options.dueDate;
        changes.push(`预计归还: ${record.dueDate} → ${options.dueDate}`);
      }
      if (options.returnDate) {
        updates.returnDate = options.returnDate;
        changes.push(`实际归还: ${record.returnDate || '(未归还)'} → ${options.returnDate}`);
      }
      if (options.returnStatus) {
        updates.returnStatus = options.returnStatus;
        changes.push(`归还状态: ${record.returnStatus} → ${options.returnStatus}`);
      }
      if (options.inspection) {
        updates.inspectionStatus = options.inspection;
        changes.push(`验收状态: ${record.inspectionStatus} → ${options.inspection}`);
      }
      if (options.damage) {
        updates.damageDescription = options.damage;
        changes.push(`污损说明: ${record.damageDescription || '(无)'} → ${options.damage}`);
      }
      if (options.compensation) {
        const amount = parseFloat(options.compensation);
        updates.compensationAmount = amount;
        changes.push(`赔付金额: ¥${record.compensationAmount} → ¥${amount}`);
      }
      if (options.compStatus) {
        updates.compensationStatus = options.compStatus;
        changes.push(`赔付状态: ${record.compensationStatus} → ${options.compStatus}`);
      }

      if (changes.length === 0) {
        console.log('⚠️  未指定任何修正项');
        console.log('请使用 --help 查看可用的修正选项');
        process.exit(0);
      }

      const oldNotes = record.notes || '';
      const reasonNote = options.reason || options.notes || '';
      const newNotes = oldNotes 
        ? `${oldNotes}\n[修正 ${new Date().toISOString().split('T')[0]}] ${reasonNote}: ${changes.join('; ')}`
        : `[修正 ${new Date().toISOString().split('T')[0]}] ${reasonNote}: ${changes.join('; ')}`;
      
      updates.notes = newNotes;

      const updated = dataStore.updateRecord(record.id, updates);

      console.log(`\n✅ 记录已修正`);
      console.log('─'.repeat(50));
      console.log(`  记录ID: ${record.id}`);
      console.log(`  样衣: ${record.garmentInfo.styleNo}-${record.garmentInfo.size}-${record.garmentInfo.color}`);
      console.log(`\n  修改内容:`);
      changes.forEach(c => console.log(`    • ${c}`));
      console.log(`\n  修正原因: ${reasonNote || '(未说明)'}`);
    });

  program
    .command('confirm')
    .description('最终确认记录（防止重复计算，历史不覆盖）')
    .option('--record <recordId>', '确认单个记录')
    .option('--all', '确认所有已归还且已验收的记录')
    .option('--batch <batchId>', '确认指定导入批次的记录')
    .action((options) => {
      dataStore.initialize();

      let recordsToConfirm = [];

      if (options.record) {
        const record = dataStore.getRecordById(options.record);
        if (!record) {
          console.error(`错误: 未找到记录 ID: ${options.record}`);
          process.exit(1);
        }
        recordsToConfirm.push(record);
      } else if (options.batch) {
        recordsToConfirm = dataStore.getRecords().filter(r => r.importBatchId === options.batch);
        if (recordsToConfirm.length === 0) {
          console.error(`错误: 未找到批次 ${options.batch} 的记录`);
          process.exit(1);
        }
      } else if (options.all) {
        recordsToConfirm = dataStore.getRecords().filter(r => 
          !r.confirmedAt &&
          r.returnStatus === 'returned' && 
          r.inspectionStatus === 'passed'
        );
      } else {
        console.error('错误: 请指定 --record、--batch 或 --all 参数');
        process.exit(1);
      }

      const confirmed = [];
      const skipped = [];
      const invalid = [];
      const now = new Date().toISOString();

      for (const record of recordsToConfirm) {
        if (record.confirmedAt) {
          skipped.push({ record, reason: '已确认' });
          continue;
        }

        if (record.returnStatus !== 'returned') {
          invalid.push({ record, reason: `未归还 (状态: ${record.returnStatus})` });
          continue;
        }

        if (record.inspectionStatus !== 'passed') {
          invalid.push({ record, reason: `未通过验收 (状态: ${record.inspectionStatus})` });
          continue;
        }

        dataStore.updateRecord(record.id, { confirmedAt: now });
        confirmed.push(record);
      }

      console.log(`\n✅ 最终确认完成`);
      console.log('─'.repeat(60));
      console.log(`  成功确认: ${confirmed.length} 条`);
      console.log(`  已确认跳过: ${skipped.length} 条`);
      console.log(`  不符合条件: ${invalid.length} 条`);

      if (confirmed.length > 0) {
        console.log(`\n  ✅ 已确认记录:`);
        confirmed.forEach(r => {
          console.log(`    • ${r.garmentInfo.styleNo}-${r.garmentInfo.size}-${r.garmentInfo.color} (${r.id})`);
        });
      }

      if (skipped.length > 0) {
        console.log(`\n  ⏭️  已确认跳过 (已在历史中确认):`);
        skipped.forEach(item => {
          console.log(`    • ${item.record.garmentInfo.styleNo}-${item.record.garmentInfo.size}-${item.record.garmentInfo.color} (${item.record.id})`);
        });
      }

      if (invalid.length > 0) {
        console.log(`\n  ❌ 不符合确认条件 (需已归还+已验收):`);
        invalid.forEach(item => {
          const g = item.record.garmentInfo;
          console.log(`    • ${g.styleNo}-${g.size}-${g.color} (${item.record.id}): ${item.reason}`);
        });
        console.log(`\n  💡 提示: 请先使用 garment return 完成归还，再用 garment inspect 完成验收`);
      }
    });

  program
    .command('list')
    .description('查看借用记录列表')
    .option('--style <styleNo>', '按款号筛选')
    .option('--department <dept>', '按部门筛选')
    .option('--status <status>', '按状态筛选: pending | returned | partial | lost')
    .option('--inspection <status>', '按验收状态筛选: not_inspected | passed | failed')
    .option('--confirmed', '仅显示已确认记录')
    .option('--unconfirmed', '仅显示未确认记录')
    .option('--limit <n>', '显示最近N条', '20')
    .action((options) => {
      dataStore.initialize();

      let records = dataStore.getRecords();

      if (options.style) {
        records = records.filter(r => r.garmentInfo.styleNo === options.style);
      }
      if (options.department) {
        records = records.filter(r => r.department === options.department);
      }
      if (options.status) {
        records = records.filter(r => r.returnStatus === options.status);
      }
      if (options.inspection) {
        records = records.filter(r => r.inspectionStatus === options.inspection);
      }
      if (options.confirmed) {
        records = records.filter(r => r.confirmedAt);
      }
      if (options.unconfirmed) {
        records = records.filter(r => !r.confirmedAt);
      }

      records = records
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, parseInt(options.limit));

      if (records.length === 0) {
        console.log('暂无符合条件的记录');
        return;
      }

      console.log(`\n📋 借用记录列表 (${records.length} 条):`);
      console.log('─'.repeat(90));
      console.log(`${'记录ID'.padEnd(20)} ${'样衣'.padEnd(20)} ${'部门'.padEnd(10)} ${'档期'.padEnd(22)} ${'状态'.padEnd(10)} ${'确认'}`);
      console.log('─'.repeat(90));

      for (const r of records) {
        const garmentKey = `${r.garmentInfo.styleNo}-${r.garmentInfo.size}-${r.garmentInfo.color}`;
        const schedule = `${r.borrowDate}~${r.dueDate}`;
        const status = r.returnStatus === 'pending' ? '借用中' : r.returnStatus;
        const confirmed = r.confirmedAt ? '✅' : '○';

        console.log(
          `${r.id.padEnd(20)} ${garmentKey.padEnd(20)} ${r.department.padEnd(10)} ${schedule.padEnd(22)} ${status.padEnd(10)} ${confirmed}`
        );
      }
    });
};
