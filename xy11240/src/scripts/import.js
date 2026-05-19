#!/usr/bin/env node

const path = require('path');
const { importCSV, importMarkdown } = require('../utils/importer');
const { initDatabase } = require('../models/database');
const config = require('../config');

async function main() {
  await initDatabase();

  const args = process.argv.slice(2);
  let filePath = null;
  let operator = config.defaultOperator;
  let role = config.defaultRole;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' || args[i] === '-f') {
      filePath = args[++i];
    } else if (args[i] === '--operator' || args[i] === '-o') {
      operator = args[++i];
    } else if (args[i] === '--role' || args[i] === '-r') {
      role = args[++i];
    } else if (!filePath && !args[i].startsWith('-')) {
      filePath = args[i];
    }
  }

  if (!filePath) {
    console.error('请指定要导入的文件路径');
    console.error('用法: node import.js <文件路径> [--operator 操作人] [--role 角色]');
    console.error('支持格式: .csv, .md');
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  console.log(`开始导入: ${fullPath}`);
  console.log(`操作人: ${operator} (${role})`);
  console.log('---');

  try {
    let result;

    if (ext === '.csv') {
      result = await importCSV(fullPath, operator, role);
    } else if (ext === '.md' || ext === '.markdown') {
      result = await importMarkdown(fullPath, operator, role);
    } else {
      console.error('不支持的文件格式，请使用 .csv 或 .md 文件');
      process.exit(1);
    }

    console.log(`导入完成!`);
    console.log(`会话ID: ${result.sessionId}`);
    console.log(`总计: ${result.total} 条`);
    console.log(`成功: ${result.successCount} 条 ✓`);
    console.log(`失败: ${result.errorCount} 条 ✗`);

    if (result.errorCount > 0) {
      console.log(`\n提示: 运行 node review.js ${result.sessionId} 查看错误详情`);
    }

    process.exit(0);
  } catch (error) {
    console.error('导入失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
