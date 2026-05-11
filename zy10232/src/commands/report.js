const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const dataStore = require('../store/dataStore');
const Validator = require('../utils/validator');

module.exports = function(program) {
  program
    .command('export-overdue')
    .description('导出逾期清单')
    .option('--format <fmt>', '输出格式: csv | json | table', 'table')
    .option('--output <file>', '输出文件路径')
    .action((options) => {
      dataStore.initialize();

      const issues = Validator.checkAllIssues();
      const records = issues.overdueRecords;
      const currentDate = new Date().toISOString().split('T')[0];

      if (records.length === 0) {
        console.log('✅ 无逾期未归还记录');
        return;
      }

      const data = records.map(r => {
        const dueDays = Math.floor((new Date(currentDate) - new Date(r.dueDate)) / (1000 * 60 * 60 * 24));
        return {
          款号: r.garmentInfo.styleNo,
          尺码: r.garmentInfo.size,
          颜色: r.garmentInfo.color,
          借用部门: r.department,
          借用人: r.borrower || '',
          借用日期: r.borrowDate,
          应还日期: r.dueDate,
          逾期天数: dueDays,
          记录ID: r.id,
          来源: r.source
        };
      });

      outputReport(data, options, `逾期清单_${currentDate}`);
    });

  program
    .command('export-uninspected')
    .description('导出未验收归还清单')
    .option('--format <fmt>', '输出格式: csv | json | table', 'table')
    .option('--output <file>', '输出文件路径')
    .action((options) => {
      dataStore.initialize();

      const issues = Validator.checkAllIssues();
      const records = issues.uninspectedReturns;

      if (records.length === 0) {
        console.log('✅ 所有归还记录已验收');
        return;
      }

      const data = records.map(r => ({
        款号: r.garmentInfo.styleNo,
        尺码: r.garmentInfo.size,
        颜色: r.garmentInfo.color,
        借用部门: r.department,
        借用人: r.borrower || '',
        借用日期: r.borrowDate,
        归还日期: r.returnDate || '',
        记录ID: r.id
      }));

      outputReport(data, options, `未验收清单_${new Date().toISOString().split('T')[0]}`);
    });

  program
    .command('export-unpaid')
    .description('导出污损未扣款清单')
    .option('--format <fmt>', '输出格式: csv | json | table', 'table')
    .option('--output <file>', '输出文件路径')
    .action((options) => {
      dataStore.initialize();

      const issues = Validator.checkAllIssues();
      const records = issues.unpaidDamages;

      if (records.length === 0) {
        console.log('✅ 无未处理的污损记录');
        return;
      }

      const data = records.map(r => ({
        款号: r.garmentInfo.styleNo,
        尺码: r.garmentInfo.size,
        颜色: r.garmentInfo.color,
        借用部门: r.department,
        污损说明: r.damageDescription,
        赔付金额: r.compensationAmount,
        赔付状态: r.compensationStatus,
        记录ID: r.id
      }));

      outputReport(data, options, `污损未扣款清单_${new Date().toISOString().split('T')[0]}`);
    });

  program
    .command('export-schedule')
    .description('导出档期占用报告')
    .option('--format <fmt>', '输出格式: csv | json | table', 'table')
    .option('--output <file>', '输出文件路径')
    .option('--date <date>', '指定日期 (YYYY-MM-DD)，默认为今天')
    .action((options) => {
      dataStore.initialize();

      const targetDate = options.date || new Date().toISOString().split('T')[0];
      const records = dataStore.getRecords().filter(r => 
        r.returnStatus !== 'returned' &&
        r.borrowDate <= targetDate &&
        r.dueDate >= targetDate
      );

      if (records.length === 0) {
        console.log(`✅ ${targetDate} 无档期占用`);
        return;
      }

      const data = records.map(r => {
        const status = r.dueDate < targetDate ? '逾期' : '正常';
        return {
          款号: r.garmentInfo.styleNo,
          尺码: r.garmentInfo.size,
          颜色: r.garmentInfo.color,
          借用部门: r.department,
          借用人: r.borrower || '',
          借用日期: r.borrowDate,
          预计归还: r.dueDate,
          状态: status,
          记录ID: r.id
        };
      }).sort((a, b) => a.款号.localeCompare(b.款号));

      outputReport(data, options, `档期报告_${targetDate}`);
    });

  program
    .command('export-all')
    .description('导出所有借用记录')
    .option('--format <fmt>', '输出格式: csv | json | table', 'table')
    .option('--output <file>', '输出文件路径')
    .option('--status <status>', '按状态筛选: pending | returned | partial | lost')
    .option('--start <date>', '开始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .action((options) => {
      dataStore.initialize();

      let records = dataStore.getRecords();

      if (options.status) {
        records = records.filter(r => r.returnStatus === options.status);
      }
      if (options.start) {
        records = records.filter(r => r.borrowDate >= options.start);
      }
      if (options.end) {
        records = records.filter(r => r.borrowDate <= options.end);
      }

      if (records.length === 0) {
        console.log('暂无符合条件的记录');
        return;
      }

      const data = records.map(r => ({
        记录ID: r.id,
        款号: r.garmentInfo.styleNo,
        尺码: r.garmentInfo.size,
        颜色: r.garmentInfo.color,
        借用部门: r.department,
        借用人: r.borrower || '',
        借用日期: r.borrowDate,
        预计归还: r.dueDate,
        实际归还: r.returnDate || '',
        归还状态: r.returnStatus,
        验收状态: r.inspectionStatus,
        污损说明: r.damageDescription || '',
        赔付金额: r.compensationAmount,
        赔付状态: r.compensationStatus,
        来源: r.source,
        是否已确认: r.confirmedAt ? '是' : '否',
        确认时间: r.confirmedAt || ''
      })).sort((a, b) => b.借用日期.localeCompare(a.借用日期));

      outputReport(data, options, `全部记录_${new Date().toISOString().split('T')[0]}`);
    });

  program
    .command('stats')
    .description('查看统计概览')
    .action(() => {
      dataStore.initialize();

      const issues = Validator.checkAllIssues();
      const records = dataStore.getRecords();
      const garments = dataStore.getGarments();
      const currentDate = new Date().toISOString().split('T')[0];

      const totalBorrowed = records.filter(r => r.returnStatus === 'pending').length;
      const totalReturned = records.filter(r => r.returnStatus === 'returned').length;
      const totalDamaged = garments.filter(g => g.status === 'damaged').length;
      const totalCompensation = records
        .filter(r => r.compensationAmount > 0)
        .reduce((sum, r) => sum + r.compensationAmount, 0);

      console.log(`\n📊 统计概览 (${currentDate})`);
      console.log('═'.repeat(50));
      console.log(`\n📦 样衣库存:`);
      console.log(`   总样衣数: ${garments.length} 件`);
      console.log(`   可用: ${garments.filter(g => g.status === 'available').length} 件`);
      console.log(`   借用中: ${garments.filter(g => g.status === 'borrowed').length} 件`);
      console.log(`   污损: ${totalDamaged} 件`);
      
      console.log(`\n📋 借用记录:`);
      console.log(`   总记录数: ${records.length} 条`);
      console.log(`   借用中: ${totalBorrowed} 条`);
      console.log(`   已归还: ${totalReturned} 条`);
      
      console.log(`\n⚠️  待处理:`);
      console.log(`   逾期未还: ${issues.overdueRecords.length} 条`);
      console.log(`   归还未验收: ${issues.uninspectedReturns.length} 条`);
      console.log(`   污损未扣款: ${issues.unpaidDamages.length} 条`);
      console.log(`   档期冲突: ${issues.scheduleOverlaps.length} 组`);
      
      console.log(`\n💰 赔付统计:`);
      console.log(`   累计赔付金额: ¥${totalCompensation.toFixed(2)}`);
    });
};

function outputReport(data, options, defaultName) {
  if (options.format === 'json') {
    const content = JSON.stringify(data, null, 2);
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, content);
      console.log(`✅ 数据已导出到: ${outputPath}`);
    } else {
      console.log(content);
    }
    return;
  }

  if (options.format === 'csv') {
    const parser = new Parser();
    const csv = parser.parse(data);
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, csv);
      console.log(`✅ 数据已导出到: ${outputPath}`);
    } else {
      console.log(csv);
    }
    return;
  }

  console.log(`\n📄 ${defaultName.replace(/_/g, ' ')} (${data.length} 条)`);
  if (data.length === 0) return;

  const keys = Object.keys(data[0]);
  const widths = keys.map(k => Math.max(k.length, ...data.map(r => String(r[k]).length)));

  const header = keys.map((k, i) => k.padEnd(widths[i])).join(' | ');
  const separator = widths.map(w => '─'.repeat(w)).join('─┼─');
  const rows = data.map(r => 
    keys.map((k, i) => String(r[k]).padEnd(widths[i])).join(' | ')
  );

  console.log('─'.repeat(header.length + 2));
  console.log(` ${header}`);
  console.log(separator);
  rows.forEach(r => console.log(` ${r}`));
  console.log('─'.repeat(header.length + 2));

  if (options.output) {
    const ext = path.extname(options.output).toLowerCase();
    const parser = new Parser();
    const content = ext === '.csv' ? parser.parse(data) : JSON.stringify(data, null, 2);
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, content);
    console.log(`\n✅ 数据已导出到: ${outputPath}`);
  }
}
