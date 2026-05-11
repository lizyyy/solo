const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dataStore = require('../store/dataStore');
const Validator = require('../utils/validator');
const ImportHistory = require('../models/importHistory');

module.exports = function(program) {
  program
    .command('import <file>')
    .description('导入拍摄清单或借用记录（支持CSV/JSON格式，自动防重复导入）')
    .option('--type <type>', '导入类型: borrow | return | inventory', 'borrow')
    .option('--force', '强制导入（忽略重复检查）', false)
    .action(async (file, options) => {
      dataStore.initialize();
      
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.error(`错误: 文件不存在 - ${filePath}`);
        process.exit(1);
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileHash = ImportHistory.computeFileHash(fileContent);
      const fileName = path.basename(filePath);

      const existingImport = dataStore.getImportByFileHash(fileHash);
      if (existingImport && !options.force) {
        console.log(`\n⚠️  检测到重复导入`);
        console.log(`   此文件已于 ${existingImport.importDate.split('T')[0]} 导入`);
        console.log(`   批次号: ${existingImport.batchId}`);
        console.log(`   记录数: ${existingImport.successCount} 条成功, ${existingImport.errorCount} 条失败`);
        console.log(`\n如需强制导入，请使用 --force 参数`);
        process.exit(0);
      }

      const importedKeys = dataStore.getAllImportedKeys();
      const importHistory = dataStore.addImportHistory({
        fileName,
        fileHash,
        importType: options.type,
        recordCount: 0,
        status: 'processing'
      });

      let records = [];
      try {
        if (filePath.endsWith('.json')) {
          records = JSON.parse(fileContent);
        } else if (filePath.endsWith('.csv')) {
          records = await parseCsv(filePath);
        } else {
          console.error('错误: 仅支持 CSV 和 JSON 格式的文件');
          process.exit(1);
        }
      } catch (e) {
        console.error(`错误: 文件解析失败 - ${e.message}`);
        dataStore.updateImportHistory(importHistory.id, {
          status: 'failed',
          errors: [e.message]
        });
        process.exit(1);
      }

      console.log(`\n📥 开始导入: ${fileName}`);
      console.log(`   类型: ${options.type}`);
      console.log(`   批次号: ${importHistory.batchId}`);
      console.log(`   总记录数: ${records.length}`);
      console.log('');

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      const errors = [];
      const newImportedKeys = [];
      const batchSeenKeys = new Set();

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i];
        const lineNum = i + 2;

        const cleanRecord = {};
        for (const key in rawRecord) {
          cleanRecord[key.trim()] = rawRecord[key];
        }

        const tempRecord = {
          garmentInfo: {
            styleNo: cleanRecord.styleNo || cleanRecord.款号 || '',
            size: cleanRecord.size || cleanRecord.尺码 || '',
            color: cleanRecord.color || cleanRecord.颜色 || ''
          },
          department: cleanRecord.department || cleanRecord.部门 || cleanRecord.借用部门 || '',
          borrower: cleanRecord.borrower || cleanRecord.借用人 || '',
          borrowDate: cleanRecord.borrowDate || cleanRecord.借用日期 || '',
          dueDate: cleanRecord.dueDate || cleanRecord.预计归还日期 || cleanRecord.档期截止 || ''
        };

        const uniqueKey = `${tempRecord.garmentInfo.styleNo}-${tempRecord.garmentInfo.size}-${tempRecord.garmentInfo.color}-${tempRecord.department}-${tempRecord.borrowDate}-${tempRecord.dueDate}`;

        if (!options.force && importedKeys.has(uniqueKey)) {
          console.log(`⏭️  [行${lineNum}] 跳过: 记录已从历史导入 (${uniqueKey})`);
          skipCount++;
          continue;
        }

        if (!options.force && batchSeenKeys.has(uniqueKey)) {
          console.log(`⏭️  [行${lineNum}] 跳过: 本批次重复行 (${uniqueKey})`);
          skipCount++;
          continue;
        }

        const validationErrors = Validator.validateBorrowData(tempRecord);
        if (validationErrors.length > 0) {
          console.log(`❌  [行${lineNum}] 验证失败: ${validationErrors.join(', ')}`);
          errors.push(`行${lineNum}: ${validationErrors.join(', ')}`);
          errorCount++;
          continue;
        }

        batchSeenKeys.add(uniqueKey);

        try {
          let garment = dataStore.getGarmentByKey(
            tempRecord.garmentInfo.styleNo,
            tempRecord.garmentInfo.size,
            tempRecord.garmentInfo.color
          );

          if (!garment) {
            garment = dataStore.addGarment({
              styleNo: tempRecord.garmentInfo.styleNo,
              size: tempRecord.garmentInfo.size,
              color: tempRecord.garmentInfo.color,
              status: 'borrowed'
            });
          }

          const overlaps = Validator.checkScheduleOverlap(garment.id, tempRecord.borrowDate, tempRecord.dueDate);
          if (overlaps.length > 0) {
            const warn = `[行${lineNum}] ⚠️  档期冲突: ${garment.getUniqueKey()} 与 ${overlaps.length} 条记录档期重叠`;
            console.log(warn);
            errors.push(warn);
          }

          const record = dataStore.addRecord({
            garmentId: garment.id,
            garmentInfo: tempRecord.garmentInfo,
            department: tempRecord.department,
            borrower: tempRecord.borrower,
            borrowDate: tempRecord.borrowDate,
            dueDate: tempRecord.dueDate,
            importBatchId: importHistory.batchId,
            source: 'import'
          });

          console.log(`✅  [行${lineNum}] 已导入: ${garment.getUniqueKey()} -> ${record.id}`);
          successCount++;
          newImportedKeys.push(uniqueKey);
        } catch (e) {
          console.log(`❌  [行${lineNum}] 处理失败: ${e.message}`);
          errors.push(`行${lineNum}: ${e.message}`);
          errorCount++;
        }
      }

      dataStore.updateImportHistory(importHistory.id, {
        recordCount: records.length,
        successCount,
        errorCount,
        status: errorCount === 0 ? 'completed' : 'partial',
        errors,
        importedKeys: newImportedKeys
      });

      console.log(`\n┌─────────────────────────────────────┐`);
      console.log(`│           导入结果汇总               │`);
      console.log(`├─────────────────────────────────────┤`);
      console.log(`│ 批次号: ${importHistory.batchId.padEnd(24)} │`);
      console.log(`│ 总记录: ${String(records.length).padEnd(28)} │`);
      console.log(`│ 成功:   ${String(successCount).padEnd(28)} │`);
      console.log(`│ 跳过:   ${String(skipCount).padEnd(28)} │`);
      console.log(`│ 失败:   ${String(errorCount).padEnd(28)} │`);
      console.log(`└─────────────────────────────────────┘`);

      if (errorCount > 0) {
        console.log(`\n详细错误已记录在导入历史中`);
      }
    });

  program
    .command('import-history')
    .description('查看导入历史记录')
    .option('--batch <batchId>', '查看指定批次详情')
    .action((options) => {
      dataStore.initialize();
      
      if (options.batch) {
        const imp = dataStore.getImportByBatchId(options.batch);
        if (!imp) {
          console.error(`未找到批次: ${options.batch}`);
          process.exit(1);
        }
        
        console.log(`\n📦 导入批次详情: ${imp.batchId}`);
        console.log(`   文件: ${imp.fileName}`);
        console.log(`   时间: ${imp.importDate}`);
        console.log(`   类型: ${imp.importType}`);
        console.log(`   状态: ${imp.status}`);
        console.log(`   记录: ${imp.successCount}/${imp.recordCount} 成功`);
        
        if (imp.errors && imp.errors.length > 0) {
          console.log(`\n   错误信息:`);
          imp.errors.forEach(e => console.log(`      • ${e}`));
        }
        return;
      }

      const history = dataStore.getImportHistory();
      if (history.length === 0) {
        console.log('暂无导入历史');
        return;
      }

      console.log('\n📚 导入历史记录:');
      console.log('─'.repeat(80));
      console.log(`${'批次号'.padEnd(18)} ${'文件'.padEnd(25)} ${'时间'.padEnd(12)} ${'状态'.padEnd(10)} ${'成功/总数'}`);
      console.log('─'.repeat(80));
      
      for (const imp of history) {
        console.log(
          `${imp.batchId.padEnd(18)} ${imp.fileName.padEnd(25)} ${imp.importDate.split('T')[0].padEnd(12)} ${imp.status.padEnd(10)} ${imp.successCount}/${imp.recordCount}`
        );
      }
    });
};

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
