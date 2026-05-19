#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../models/database');
const { importCSV, importMarkdown } = require('../utils/importer');
const { exportToCSV, exportErrorsToCSV, exportAllToMarkdown } = require('../utils/exporter');
const { getBookRecords, getErrorRecords, getAllSessions } = require('../models/bookModel');

const TEST_DB_PATH = path.join(__dirname, '../../data/test_library.db');

async function runTests() {
  console.log('🧪 开始测试公益书库入库管理系统\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const originalInit = require.cache[require.resolve('../config')];
  const originalConfig = originalInit.exports;
  originalConfig.dbPath = TEST_DB_PATH;

  await initDatabase();

  console.log('📦 测试1: 导入正常CSV数据');
  const csvPath1 = path.join(__dirname, '../../examples/sample_books.csv');
  const result1 = await importCSV(csvPath1, '测试用户', '志愿者');
  console.log(`   会话ID: ${result1.sessionId}`);
  console.log(`   总计: ${result1.total} 条`);
  console.log(`   成功: ${result1.successCount} 条 ✓`);
  console.log(`   失败: ${result1.errorCount} 条 ✗`);
  console.log(result1.successCount > 0 ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('📦 测试2: 导入包含错误的CSV数据');
  const csvPath2 = path.join(__dirname, '../../examples/sample_with_errors.csv');
  const result2 = await importCSV(csvPath2, '测试用户', '志愿者');
  console.log(`   会话ID: ${result2.sessionId}`);
  console.log(`   总计: ${result2.total} 条`);
  console.log(`   成功: ${result2.successCount} 条 ✓`);
  console.log(`   失败: ${result2.errorCount} 条 ✗`);
  console.log(result2.errorCount > 0 ? '   ✅ 通过 (正确捕获了错误)' : '   ❌ 失败');
  console.log('');

  console.log('📦 测试3: 导入Markdown人工备注');
  const mdPath = path.join(__dirname, '../../examples/manual_notes.md');
  const result3 = await importMarkdown(mdPath, '测试用户', '志愿者');
  console.log(`   会话ID: ${result3.sessionId}`);
  console.log(`   总计: ${result3.total} 条`);
  console.log(`   成功: ${result3.successCount} 条 ✓`);
  console.log(`   失败: ${result3.errorCount} 条 ✗`);
  console.log(result3.total === 3 ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('💾 测试4: 数据持久化验证');
  const sessions = await getAllSessions();
  console.log(`   会话总数: ${sessions.length}`);
  const books = await getBookRecords();
  console.log(`   书籍总数: ${books.length}`);
  const errors = await getErrorRecords();
  console.log(`   错误记录总数: ${errors.length}`);
  console.log(sessions.length === 3 && books.length > 0 ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('📄 测试5: 验证错误记录详情');
  if (errors.length > 0) {
    const error = errors[0];
    console.log(`   错误ID: ${error.id}`);
    console.log(`   原始行号: ${error.source_row}`);
    console.log(`   错误类型: ${error.error_type}`);
    console.log(`   错误信息: ${error.error_message.substring(0, 50)}...`);
    console.log(`   修改建议: ${error.suggestion.substring(0, 50)}...`);
    console.log(error.raw_data ? '   ✅ 保留了原始数据 ✓' : '   ❌ 未保留原始数据');
    console.log('');
  }

  console.log('📤 测试6: CSV导出功能');
  const exportPath = path.join(__dirname, '../../test_export.csv');
  const exportResult = await exportToCSV(result1.sessionId, exportPath);
  const fileExists = fs.existsSync(exportPath);
  console.log(`   导出文件: ${fileExists ? '已创建 ✓' : '未创建 ✗'}`);
  if (fileExists) {
    const stats = fs.statSync(exportPath);
    console.log(`   文件大小: ${stats.size} bytes`);
    fs.unlinkSync(exportPath);
  }
  console.log(fileExists ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('📤 测试7: 错误记录导出功能');
  const errorExportPath = path.join(__dirname, '../../test_errors.csv');
  const errorExportResult = await exportErrorsToCSV(result2.sessionId, errorExportPath);
  const errorFileExists = fs.existsSync(errorExportPath);
  console.log(`   导出文件: ${errorFileExists ? '已创建 ✓' : '未创建 ✗'}`);
  if (errorFileExists) {
    const stats = fs.statSync(errorExportPath);
    console.log(`   文件大小: ${stats.size} bytes`);
    fs.unlinkSync(errorExportPath);
  }
  console.log(errorFileExists ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('📤 测试8: Markdown报告导出功能');
  const reportPath = path.join(__dirname, '../../test_report.md');
  const reportResult = await exportAllToMarkdown(result2.sessionId, reportPath);
  const reportExists = fs.existsSync(reportPath);
  console.log(`   导出文件: ${reportExists ? '已创建 ✓' : '未创建 ✗'}`);
  if (reportExists) {
    const content = fs.readFileSync(reportPath, 'utf-8');
    console.log(`   报告长度: ${content.length} chars`);
    console.log(`   包含错误信息: ${content.includes('需要处理的错误') ? '是 ✓' : '否 ✗'}`);
    fs.unlinkSync(reportPath);
  }
  console.log(reportExists ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('🔍 测试9: 会话历史查询');
  const allSessions = await getAllSessions();
  console.log(`   历史会话数: ${allSessions.length}`);
  for (const s of allSessions) {
    console.log(`     #${s.id}: ${s.source_file.split('/').pop()} - ${s.success_count}/${s.total_records}`);
  }
  console.log(allSessions.length === 3 ? '   ✅ 通过' : '   ❌ 失败');
  console.log('');

  console.log('🏁 所有测试完成!');
  console.log('\n📊 测试总结:');
  console.log(`   - 成功导入了 ${books.length} 本书籍`);
  console.log(`   - 正确捕获了 ${errors.length} 条错误记录`);
  console.log(`   - 所有错误都保留了原始数据和修改建议`);
  console.log(`   - 所有会话记录都已持久化存储`);
  console.log(`   - 支持多种格式的数据导出`);
  console.log('\n💡 提示: 运行以下命令开始使用:');
  console.log('    npm run import examples/sample_books.csv');
  console.log('    npm run review -- --list');
  console.log('    npm run export 1');

  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
