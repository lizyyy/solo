#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { importCsv } from './importers/csv';
import { importMarkdown } from './importers/markdown';
import { bookRepo, errorRepo, closeDb, BookStatus, ErrorType } from './database';
import { exportBooks, exportErrors, getStatusLabel, getErrorTypeLabel } from './exporter/csv';

const handleError = (message: string) => {
  console.error(chalk.red(`错误: ${message}`));
  closeDb();
  process.exit(1);
};

const success = (message: string) => {
  console.log(chalk.green(`✓ ${message}`));
};

const info = (message: string) => {
  console.log(chalk.blue(`ℹ ${message}`));
};

const warning = (message: string) => {
  console.log(chalk.yellow(`⚠ ${message}`));
};

yargs(hideBin(process.argv))
  .command(
    ['import-csv <file>', 'csv <file>'],
    '导入 CSV 扫码数据',
    (yargs) => {
      return yargs
        .positional('file', { type: 'string', demandOption: true, describe: 'CSV 文件路径' })
        .option('volunteer', { alias: 'v', type: 'string', demandOption: true, describe: '负责人姓名' });
    },
    async (argv) => {
      try {
        info(`开始导入 CSV 文件: ${argv.file}`);
        const result = await importCsv(argv.file, argv.volunteer);
        
        success(`导入会话 #${result.sessionId} 完成`);
        info(`总计: ${result.totalRecords} 条记录`);
        success(`成功: ${result.successCount} 条`);
        if (result.errorCount > 0) {
          warning(`失败: ${result.errorCount} 条`);
          console.log('\n错误详情:');
          result.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. 第${err.row}行 [${getErrorTypeLabel(err.type)}]: ${err.message}`);
          });
        }
      } catch (err) {
        handleError(err instanceof Error ? err.message : '导入失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    ['import-md <file>', 'md <file>'],
    '导入 Markdown 人工备注',
    (yargs) => {
      return yargs
        .positional('file', { type: 'string', demandOption: true, describe: 'Markdown 文件路径' })
        .option('volunteer', { alias: 'v', type: 'string', demandOption: true, describe: '负责人姓名' });
    },
    async (argv) => {
      try {
        info(`开始导入 Markdown 文件: ${argv.file}`);
        const result = await importMarkdown(argv.file, argv.volunteer);
        
        success(`导入会话 #${result.sessionId} 完成`);
        info(`总计: ${result.totalRecords} 条记录`);
        success(`成功: ${result.successCount} 条`);
        if (result.errorCount > 0) {
          warning(`失败: ${result.errorCount} 条`);
          console.log('\n错误详情:');
          result.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. 第${err.line}行 [${getErrorTypeLabel(err.type)}]: ${err.message}`);
          });
        }
      } catch (err) {
        handleError(err instanceof Error ? err.message : '导入失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    'list',
    '列出所有书籍记录',
    (yargs) => {
      return yargs
        .option('volunteer', { alias: 'v', type: 'string', describe: '按负责人筛选' })
        .option('status', { alias: 's', type: 'string', describe: '按状态筛选 (pending/approved/rejected/shelved)' })
        .option('start-date', { type: 'string', describe: '开始日期 (YYYY-MM-DD)' })
        .option('end-date', { type: 'string', describe: '结束日期 (YYYY-MM-DD)' });
    },
    (argv) => {
      try {
        const filters: {
          volunteer?: string;
          status?: BookStatus;
          startDate?: string;
          endDate?: string;
        } = {};
        
        if (argv.volunteer) filters.volunteer = argv.volunteer;
        if (argv.status) filters.status = argv.status as BookStatus;
        if (argv['start-date']) filters.startDate = argv['start-date'];
        if (argv['end-date']) filters.endDate = argv['end-date'];

        const books = bookRepo.findAll(filters);
        
        info(`找到 ${books.length} 条记录:\n`);
        books.forEach(book => {
          console.log(`#${book.id} ISBN:${book.isbn}`);
          console.log(`  书名: ${book.title || '未知'}`);
          console.log(`  品相: ${book.condition || '未知'} | 年级: ${book.grade || '通用'}`);
          console.log(`  状态: ${getStatusLabel(book.status)} | 负责人: ${book.volunteer}`);
          console.log('');
        });
      } catch (err) {
        handleError(err instanceof Error ? err.message : '查询失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    'errors',
    '列出异常记录',
    (yargs) => {
      return yargs
        .option('type', { alias: 't', type: 'string', describe: '按错误类型筛选' })
        .option('volunteer', { alias: 'v', type: 'string', describe: '按负责人筛选' })
        .option('resolved', { alias: 'r', type: 'boolean', describe: '仅显示已解决' });
    },
    (argv) => {
      try {
        const filters: {
          type?: ErrorType;
          resolved?: boolean;
          volunteer?: string;
        } = {};
        
        if (argv.type) filters.type = argv.type as ErrorType;
        if (argv.volunteer) filters.volunteer = argv.volunteer;
        if (argv.resolved !== undefined) filters.resolved = argv.resolved;

        const errors = errorRepo.findAll(filters);
        
        info(`找到 ${errors.length} 条异常记录:\n`);
        errors.forEach(err => {
          console.log(`#${err.id} [${getErrorTypeLabel(err.error_type)}]`);
          console.log(`  文件: ${err.source_file} (第${err.row_number}行)`);
          console.log(`  错误: ${err.error_message}`);
          console.log(`  建议: ${err.suggestion}`);
          console.log(`  状态: ${err.resolved ? '已解决' : '待处理'}`);
          console.log('');
        });
      } catch (err) {
        handleError(err instanceof Error ? err.message : '查询失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    ['approve <id>', 'review-approve <id>'],
    '复核通过',
    (yargs) => {
      return yargs
        .positional('id', { type: 'number', demandOption: true, describe: '书籍 ID' })
        .option('notes', { alias: 'n', type: 'string', describe: '备注' });
    },
    (argv) => {
      try {
        const book = bookRepo.findById(argv.id);
        if (!book) {
          handleError(`找不到 ID 为 ${argv.id} 的记录`);
          return;
        }
        
        bookRepo.updateStatus(argv.id, 'approved', argv.notes);
        success(`记录 #${argv.id} 已复核通过`);
      } catch (err) {
        handleError(err instanceof Error ? err.message : '操作失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    ['reject <id>', 'review-reject <id>'],
    '复核拒绝',
    (yargs) => {
      return yargs
        .positional('id', { type: 'number', demandOption: true, describe: '书籍 ID' })
        .option('reason', { alias: 'r', type: 'string', demandOption: true, describe: '拒绝原因' });
    },
    (argv) => {
      try {
        const book = bookRepo.findById(argv.id);
        if (!book) {
          handleError(`找不到 ID 为 ${argv.id} 的记录`);
          return;
        }
        
        bookRepo.updateStatus(argv.id, 'rejected', argv.reason);
        success(`记录 #${argv.id} 已拒绝，原因: ${argv.reason}`);
      } catch (err) {
        handleError(err instanceof Error ? err.message : '操作失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    'export <file>',
    '导出书籍报告',
    (yargs) => {
      return yargs
        .positional('file', { type: 'string', demandOption: true, describe: '导出文件路径' })
        .option('volunteer', { alias: 'v', type: 'string', describe: '按负责人筛选' })
        .option('status', { alias: 's', type: 'string', describe: '按状态筛选' })
        .option('errors', { alias: 'e', type: 'boolean', describe: '导出异常记录' });
    },
    async (argv) => {
      try {
        if (argv.errors) {
          const filters: { type?: ErrorType; volunteer?: string } = {};
          if (argv.volunteer) filters.volunteer = argv.volunteer;
          
          const errors = errorRepo.findAll(filters);
          await exportErrors(argv.file, errors);
          success(`已导出 ${errors.length} 条异常记录到 ${argv.file}`);
        } else {
          const filters: { volunteer?: string; status?: BookStatus } = {};
          if (argv.volunteer) filters.volunteer = argv.volunteer;
          if (argv.status) filters.status = argv.status as BookStatus;
          
          const books = bookRepo.findAll(filters);
          await exportBooks(argv.file, books);
          success(`已导出 ${books.length} 条书籍记录到 ${argv.file}`);
        }
      } catch (err) {
        handleError(err instanceof Error ? err.message : '导出失败');
      } finally {
        closeDb();
      }
    }
  )
  .command(
    'stats',
    '显示统计信息',
    () => {},
    () => {
      try {
        const allBooks = bookRepo.findAll();
        const pendingBooks = bookRepo.findAll({ status: 'pending' });
        const approvedBooks = bookRepo.findAll({ status: 'approved' });
        const allErrors = errorRepo.findAll();
        const unresolvedErrors = errorRepo.findAll({ resolved: false });

        const volunteerStats = new Map<string, number>();
        allBooks.forEach(book => {
          volunteerStats.set(book.volunteer, (volunteerStats.get(book.volunteer) || 0) + 1);
        });

        info('=== 统计信息 ===\n');
        console.log(`书籍总数: ${allBooks.length}`);
        console.log(`  待复核: ${pendingBooks.length}`);
        console.log(`  已通过: ${approvedBooks.length}`);
        console.log(`异常记录: ${allErrors.length}`);
        console.log(`  待处理: ${unresolvedErrors.length}`);
        
        console.log('\n按负责人统计:');
        volunteerStats.forEach((count, name) => {
          console.log(`  ${name}: ${count} 条`);
        });
      } catch (err) {
        handleError(err instanceof Error ? err.message : '统计失败');
      } finally {
        closeDb();
      }
    }
  )
  .demandCommand()
  .help()
  .wrap(100)
  .parse();
