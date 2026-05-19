#!/usr/bin/env node

const path = require('path');
const { initDatabase } = require('../models/database');
const { exportToCSV, exportErrorsToCSV, exportAllToMarkdown, generateSessionReport } = require('../utils/exporter');

async function main() {
  await initDatabase();

  const args = process.argv.slice(2);
  let sessionId = null;
  let outputPath = null;
  let exportErrors = false;
  let exportReport = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--errors' || args[i] === '-e') {
      exportErrors = true;
    } else if (args[i] === '--report' || args[i] === '-r') {
      exportReport = true;
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (!sessionId && /^\d+$/.test(args[i])) {
      sessionId = parseInt(args[i]);
    }
  }

  if (!sessionId && !exportReport) {
    console.log('用法:');
    console.log('  导出书籍CSV: node export.js <会话ID> [--output <文件路径>]');
    console.log('  导出错误CSV: node export.js <会话ID> --errors [--output <文件路径>]');
    console.log('  导出完整报告: node export.js <会话ID> --report [--output <文件路径>]');
    console.log('  查看历史报告: node export.js --report');
    console.log('');
    const report = await generateSessionReport();
    console.log(report);
    return;
  }

  if (exportReport && !sessionId) {
    console.log(await generateSessionReport());
    return;
  }

  try {
    let result;

    if (exportReport) {
      const defaultPath = path.join(process.cwd(), `session_${sessionId}_report.md`);
      result = await exportAllToMarkdown(sessionId, outputPath || defaultPath);
      console.log(`报告已导出: ${result.filePath}`);
    } else if (exportErrors) {
      const defaultPath = path.join(process.cwd(), `session_${sessionId}_errors.csv`);
      result = await exportErrorsToCSV(sessionId, outputPath || defaultPath);
      console.log(`错误记录已导出: ${result.filePath} (${result.errorCount}条)`);
    } else {
      const defaultPath = path.join(process.cwd(), `session_${sessionId}_books.csv`);
      result = await exportToCSV(sessionId, outputPath || defaultPath);
      console.log(`书籍列表已导出: ${result.filePath} (${result.recordCount}条)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('导出失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
