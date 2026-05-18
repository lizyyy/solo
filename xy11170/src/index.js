const { parseCSV } = require('./parser');
const { auditAll } = require('./auditor');
const { writeAuditResults, ensureOutputDir } = require('./writer');
const { generateSummaryReport, printConsoleReport } = require('./reporter');
const path = require('path');

async function preview(inputPath) {
  try {
    console.log(`正在预览数据: ${inputPath}`);
    const records = await parseCSV(inputPath);
    
    console.log(`\n共读取到 ${records.length} 条记录\n`);
    console.log('前5条记录预览:');
    console.log('-'.repeat(80));
    
    for (let i = 0; i < Math.min(5, records.length); i++) {
      const r = records[i];
      console.log(`预约ID: ${r.bookingId}`);
      console.log(`排练室: ${r.studioName} | 客户: ${r.customerName} | 舞种: ${r.danceType}`);
      console.log(`预约时间: ${r.scheduledStartTime.toLocaleString()} - ${r.scheduledEndTime.toLocaleString()}`);
      console.log(`实际时间: ${r.actualStartTime.toLocaleString()} - ${r.actualEndTime.toLocaleString()}`);
      console.log(`费用: ${r.hourlyRate}元/小时 × 计费 ${r.billedAmount}元`);
      console.log('-'.repeat(80));
    }
    
    console.log('\n预览完成，请检查数据格式是否正确');
    return records;
  } catch (error) {
    console.error('预览失败:', error.message);
    throw error;
  }
}

async function audit(inputPath, outputDir) {
  try {
    console.log(`开始计费核对...`);
    console.log(`输入文件: ${inputPath}`);
    console.log(`输出目录: ${outputDir}`);
    
    const records = await parseCSV(inputPath);
    console.log(`\n共读取 ${records.length} 条记录`);
    
    const auditResult = auditAll(records);
    console.log(`核对完成: 正常 ${auditResult.normalCount} 条, 异常 ${auditResult.abnormalCount} 条`);
    
    const writeResult = await writeAuditResults(auditResult, outputDir);
    console.log(`已写入文件: 正常记录 ${writeResult.normalCount} 条, 异常记录 ${writeResult.abnormalCount} 条, 异常详情 ${writeResult.anomalyCount} 条`);
    
    const reportResult = generateSummaryReport(auditResult, outputDir);
    console.log(`异常摘要报告已生成: ${reportResult.reportPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('核对完成! 请查看输出目录获取详细结果');
    console.log('='.repeat(60));
    
    return {
      auditResult,
      writeResult,
      reportResult
    };
  } catch (error) {
    console.error('核对失败:', error.message);
    throw error;
  }
}

async function generateReport(outputDir) {
  try {
    const fs = require('fs');
    const csv = require('csv-parser');
    
    console.log(`正在从输出目录读取数据生成报告...`);
    console.log(`输出目录: ${outputDir}`);
    
    const abnormalRecordsPath = path.join(outputDir, '异常记录.csv');
    const normalRecordsPath = path.join(outputDir, '正常记录.csv');
    
    if (!fs.existsSync(abnormalRecordsPath) || !fs.existsSync(normalRecordsPath)) {
      throw new Error('输出目录中找不到必要的文件，请先执行audit命令');
    }
    
    let normalCount = 0;
    let abnormalCount = 0;
    const abnormalRecords = [];
    
    await new Promise((resolve) => {
      fs.createReadStream(normalRecordsPath)
        .pipe(csv())
        .on('data', () => normalCount++)
        .on('end', resolve);
    });
    
    await new Promise((resolve) => {
      fs.createReadStream(abnormalRecordsPath)
        .pipe(csv())
        .on('data', (row) => {
          abnormalCount++;
          abnormalRecords.push({
            record: {
              bookingId: row.预约ID,
              customerName: row.客户姓名
            },
            anomalies: [{
              type: row.异常类型,
              description: row.异常类型,
              severity: row.严重程度 === '严重' ? 'critical' : 
                        row.严重程度 === '错误' ? 'error' : 'warning',
              suggestion: '请查看异常详情.csv获取具体修复建议'
            }]
          });
        })
        .on('end', resolve);
    });
    
    const auditResult = {
      total: normalCount + abnormalCount,
      normalCount,
      abnormalCount,
      abnormalRecords
    };
    
    const reportResult = generateSummaryReport(auditResult, outputDir);
    printConsoleReport(reportResult);
    
    return reportResult;
  } catch (error) {
    console.error('报告生成失败:', error.message);
    throw error;
  }
}

module.exports = {
  preview,
  audit,
  generateReport
};
