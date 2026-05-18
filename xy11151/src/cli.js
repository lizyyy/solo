#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const {
  STABLE_COLUMN_ORDER,
  normalizeRecord,
  sortRecords,
  formatForOutput,
  deduplicateRecords
} = require('./cost-processor');

const argv = yargs(hideBin(process.argv))
  .usage('Usage: exhibition-cost [options] <files...>')
  .example('exhibition-cost data/*.csv -o output.csv', '处理所有CSV文件并输出')
  .option('output', {
    alias: 'o',
    type: 'string',
    description: '输出文件路径',
    default: 'cost-collection-output.csv'
  })
  .option('summary', {
    alias: 's',
    type: 'boolean',
    description: '显示详细摘要报告',
    default: true
  })
  .demandCommand(1, '请指定至少一个输入文件')
  .help()
  .argv;

async function processFile(filePath) {
  const results = [];
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        try {
          const normalized = normalizeRecord(data, fileName);
          results.push({
            success: true,
            data: normalized,
            row: results.length + 2
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            row: results.length + 2,
            raw: data
          });
        }
      })
      .on('end', () => {
        resolve({
          fileName,
          records: results,
          successCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length
        });
      })
      .on('error', (error) => {
        reject({
          fileName,
          error: error.message
        });
      });
  });
}

async function main() {
  const inputFiles = argv._;
  const fileResults = [];
  const allRecords = [];
  const skippedFiles = [];

  console.log('\n========================================');
  console.log('  展会搭建队展会费用归集 CLI');
  console.log('========================================\n');

  for (const file of inputFiles) {
    const filePath = path.resolve(file);
    
    if (!fs.existsSync(filePath)) {
      skippedFiles.push({ fileName: path.basename(file), reason: '文件不存在' });
      console.log(`⚠️  跳过: ${file} (文件不存在)`);
      continue;
    }

    if (!filePath.toLowerCase().endsWith('.csv')) {
      skippedFiles.push({ fileName: path.basename(file), reason: '非CSV文件' });
      console.log(`⚠️  跳过: ${file} (非CSV文件)`);
      continue;
    }

    try {
      console.log(`📄 处理中: ${file}`);
      const result = await processFile(filePath);
      fileResults.push(result);
      result.records.forEach(r => {
        if (r.success) {
          allRecords.push(r.data);
        }
      });
    } catch (error) {
      skippedFiles.push({ fileName: error.fileName, reason: error.error });
      console.log(`❌ 失败: ${file} - ${error.error}`);
    }
  }

  console.log('\n----------------------------------------\n');

  const deduplicatedRecords = deduplicateRecords(allRecords);
  const sortedRecords = sortRecords(deduplicatedRecords);
  const outputRecords = sortedRecords.map(formatForOutput);

  const csvWriter = createCsvWriter({
    path: argv.output,
    header: STABLE_COLUMN_ORDER.map(col => ({
      id: col,
      title: col
    })),
    encoding: 'utf8'
  });

  await csvWriter.writeRecords(outputRecords);

  if (argv.summary) {
    generateSummaryReport(fileResults, skippedFiles, outputRecords, argv.output);
  }

  console.log(`✅ 处理完成! 输出文件: ${argv.output}`);
  console.log(`   总记录数: ${outputRecords.length} (去重后)`);
}

function generateSummaryReport(fileResults, skippedFiles, allRecords, outputPath) {
  const totalSuccess = fileResults.reduce((sum, f) => sum + f.successCount, 0);
  const totalFailed = fileResults.reduce((sum, f) => sum + f.failedCount, 0);
  const totalSkipped = skippedFiles.length;
  
  const tempAddCount = allRecords.filter(r => r.isTemporaryAdd === '是').length;
  const refundCount = allRecords.filter(r => r.isSupplierRefund === '是').length;
  const totalAmount = allRecords.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  console.log('📊 ====== 处理摘要报告 ======\n');
  
  console.log('📁 文件处理情况:');
  console.log(`   成功处理文件: ${fileResults.length}`);
  console.log(`   跳过文件: ${totalSkipped}`);
  if (skippedFiles.length > 0) {
    skippedFiles.forEach(s => {
      console.log(`     - ${s.fileName}: ${s.reason}`);
    });
  }
  console.log();

  console.log('📝 记录处理情况:');
  console.log(`   成功: ${totalSuccess} 条`);
  console.log(`   失败: ${totalFailed} 条`);
  console.log(`   去重后: ${allRecords.length} 条\n`);

  if (fileResults.length > 0) {
    console.log('📄 各文件详情:');
    fileResults.forEach(f => {
      console.log(`   ${f.fileName}:`);
      console.log(`     成功: ${f.successCount}, 失败: ${f.failedCount}`);
    });
    console.log();
  }

  console.log('🏗️  展会搭建费用分析:');
  console.log(`   总金额: ¥${totalAmount.toFixed(2)}`);
  console.log(`   临时加项: ${tempAddCount} 条`);
  console.log(`   供应商返款/折扣: ${refundCount} 条\n`);

  const categoryStats = {};
  allRecords.forEach(r => {
    const cat = r.itemCategory || '未分类';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, amount: 0 };
    }
    categoryStats[cat].count++;
    categoryStats[cat].amount += parseFloat(r.amount || 0);
  });

  console.log('📂 按费用类别统计:');
  Object.entries(categoryStats)
    .sort((a, b) => b[1].amount - a[1].amount)
    .forEach(([category, stats]) => {
      console.log(`   ${category}: ${stats.count}条, 金额 ¥${stats.amount.toFixed(2)}`);
    });

  console.log('\n==============================\n');
}

main().catch(error => {
  console.error('❌ 发生错误:', error.message);
  process.exit(1);
});
