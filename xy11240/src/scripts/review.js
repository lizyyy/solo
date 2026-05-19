#!/usr/bin/env node

const { initDatabase } = require('../models/database');
const { getSession, getBookRecords, getErrorRecords, getAllSessions, updateBookStatus, resolveError } = require('../models/bookModel');
const config = require('../config');

async function main() {
  await initDatabase();

  const args = process.argv.slice(2);
  let sessionId = null;
  let action = null;
  let bookId = null;
  let errorId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--approve' || args[i] === '-a') {
      action = 'approve';
      bookId = parseInt(args[++i]);
    } else if (args[i] === '--reject' || args[i] === '-r') {
      action = 'reject';
      bookId = parseInt(args[++i]);
    } else if (args[i] === '--resolve' || args[i] === '-s') {
      action = 'resolve';
      errorId = parseInt(args[++i]);
    } else if (args[i] === '--list' || args[i] === '-l') {
      action = 'list';
    } else if (!sessionId && /^\d+$/.test(args[i])) {
      sessionId = parseInt(args[i]);
    }
  }

  if (action === 'list') {
    await listAllSessions();
    return;
  }

  if (action === 'approve' && bookId) {
    await updateBookStatus(bookId, 'approved');
    console.log(`书籍 #${bookId} 已批准`);
    return;
  }

  if (action === 'reject' && bookId) {
    await updateBookStatus(bookId, 'rejected');
    console.log(`书籍 #${bookId} 已拒绝`);
    return;
  }

  if (action === 'resolve' && errorId) {
    await resolveError(errorId);
    console.log(`错误 #${errorId} 已标记为已解决`);
    return;
  }

  if (!sessionId) {
    console.log('用法:');
    console.log('  查看所有会话: node review.js --list');
    console.log('  查看会话详情: node review.js <会话ID>');
    console.log('  批准书籍: node review.js --approve <书籍ID>');
    console.log('  拒绝书籍: node review.js --reject <书籍ID>');
    console.log('  标记错误已解决: node review.js --resolve <错误ID>');
    console.log('');
    await listAllSessions();
    return;
  }

  await reviewSession(sessionId);
}

async function listAllSessions() {
  const sessions = await getAllSessions();
  console.log('=== 导入历史记录 ===\n');

  if (sessions.length === 0) {
    console.log('暂无导入记录');
    return;
  }

  for (const session of sessions) {
    console.log(`#${session.id} - ${session.import_time}`);
    console.log(`  文件: ${session.source_file}`);
    console.log(`  操作人: ${session.operator} (${session.role})`);
    console.log(`  总计: ${session.total_records} | 成功: ${session.success_count} | 失败: ${session.error_count}`);
    console.log(`  状态: ${session.status}`);
    console.log('');
  }
}

async function reviewSession(sessionId) {
  const session = await getSession(sessionId);

  if (!session) {
    console.log(`会话 #${sessionId} 不存在`);
    return;
  }

  console.log(`=== 会话 #${sessionId} 复核报告 ===\n`);
  console.log(`源文件: ${session.source_file}`);
  console.log(`导入类型: ${session.source_type}`);
  console.log(`操作人: ${session.operator} (${session.role})`);
  console.log(`导入时间: ${session.import_time}`);
  console.log(`统计: 总计${session.total_records}条 | 成功${session.success_count}条 | 失败${session.error_count}条`);
  console.log('');

  const books = await getBookRecords(sessionId);
  if (books.length > 0) {
    console.log(`--- 成功导入的书籍 (${books.length}条) ---`);
    for (const book of books) {
      console.log(`\n#${book.id} [${book.status}] ${book.title}`);
      console.log(`  ISBN: ${book.isbn}`);
      console.log(`  年级: ${book.grade} | 品相: ${book.condition}`);
      if (book.author) console.log(`  作者: ${book.author}`);
      if (book.donor) console.log(`  捐赠人: ${book.donor}`);
    }
    console.log('');
  }

  const errors = await getErrorRecords(sessionId, false);
  if (errors.length > 0) {
    console.log(`--- 需要处理的错误 (${errors.length}条) ---`);
    for (const error of errors) {
      const raw = JSON.parse(error.raw_data || '{}');
      console.log(`\n#${error.id} - 第 ${error.source_row} 行`);
      console.log(`  错误: ${error.error_message}`);
      console.log(`  建议: ${error.suggestion}`);
      console.log(`  原始书名: ${raw.title || '未知'}`);
      console.log(`  原始ISBN: ${raw.isbn || '未填写'}`);
    }
    console.log('');
    console.log('处理命令:');
    console.log(`  node review.js --resolve <错误ID>  标记为已解决`);
  }

  console.log('\n导出命令:');
  console.log(`  node export.js ${sessionId}              导出CSV`);
  console.log(`  node export.js ${sessionId} --errors     导出错误记录`);
  console.log(`  node export.js ${sessionId} --report     导出完整报告`);
}

main();
