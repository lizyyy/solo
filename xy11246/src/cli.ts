#!/usr/bin/env node

import { BookDatabase } from './database';
import { BookService } from './bookService';
import { Role, ProcessingStatus, BookInput } from './types';
import * as fs from 'fs';
import * as path from 'path';

const db = new BookDatabase();
const service = new BookService(db);

interface CLIOptions {
  operator: string;
  role: Role;
}

function parseArgs(): { command: string; options: CLIOptions; args: string[] } {
  const argv = process.argv.slice(2);
  let operator = '匿名用户';
  let role: Role = Role.VOLUNTEER;

  const filteredArgs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--operator' && i + 1 < argv.length) {
      operator = argv[++i];
    } else if (argv[i] === '--role' && i + 1 < argv.length) {
      const roleStr = argv[++i];
      if (roleStr === 'admin') role = Role.ADMIN;
      else if (roleStr === 'auditor') role = Role.AUDITOR;
      else role = Role.VOLUNTEER;
    } else {
      filteredArgs.push(argv[i]);
    }
  }

  const command = filteredArgs[0] || 'help';
  return { command, options: { operator, role }, args: filteredArgs.slice(1) };
}

function printHelp(): void {
  console.log(`
公益书库捐书入库管理系统

用法: npm run cli -- [命令] [选项]

命令:
  import <json文件>        从JSON文件导入书籍数据
  batches                   查看所有导入批次
  batch <批次ID>            查看批次详情
  results <批次ID>          查看批次处理结果
  shelf <批次ID>            生成上架单
  shelf-list                查看所有上架单
  history [选项]            查看历史记录
  help                      显示帮助信息

选项:
  --operator <姓名>         操作人姓名 (默认: 匿名用户)
  --role <角色>             角色: volunteer/admin/auditor (默认: volunteer)

示例:
  npm run cli -- import sample-books.json --operator 张三
  npm run cli -- batches
  npm run cli -- results 批次ID
  npm run cli -- shelf 批次ID
  npm run cli -- history --operator 张三
`);
}

function loadBooksFromFile(filePath: string): BookInput[] {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`文件不存在: ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

async function handleImport(filePath: string, options: CLIOptions): Promise<void> {
  const books = loadBooksFromFile(filePath);
  console.log(`\n开始导入 ${books.length} 本书籍...`);

  const result = await service.importBooks(books, options.operator, options.role);

  console.log(`\n导入完成!`);
  console.log(`批次ID: ${result.batch.id}`);
  console.log(`操作人: ${result.batch.operator} (${result.batch.operatorRole})`);
  console.log(`导入时间: ${result.batch.importedAt.toLocaleString()}`);
  console.log(`总计: ${result.batch.totalCount} 本`);
  console.log(`  通过: ${result.batch.acceptedCount} 本`);
  console.log(`  拒绝: ${result.batch.rejectedCount} 本`);
  console.log(`  重复: ${result.batch.duplicateCount} 本`);

  console.log(`\n处理结果详情:`);
  result.results.forEach((r, index) => {
    const statusIcon = r.status === ProcessingStatus.ACCEPTED ? '✓' :
      r.status === ProcessingStatus.REJECTED ? '✗' : '→';
    console.log(`  ${index + 1}. ${statusIcon} [${r.status}] ${r.input.title}`);
    console.log(`     原因: ${r.reason}`);
  });
  console.log();
}

async function handleBatches(): Promise<void> {
  const batches = await service.getAllBatches();
  if (batches.length === 0) {
    console.log('暂无导入批次');
    return;
  }

  console.log(`\n共 ${batches.length} 个导入批次:\n`);
  batches.forEach((batch, index) => {
    console.log(`${index + 1}. 批次ID: ${batch.id}`);
    console.log(`   操作人: ${batch.operator} (${batch.operatorRole})`);
    console.log(`   时间: ${batch.importedAt.toLocaleString()}`);
    console.log(`   总计: ${batch.totalCount} | 通过: ${batch.acceptedCount} | 拒绝: ${batch.rejectedCount} | 重复: ${batch.duplicateCount}`);
    console.log();
  });
}

async function handleBatch(batchId: string): Promise<void> {
  const batch = await service.getBatch(batchId);
  if (!batch) {
    console.log(`未找到批次: ${batchId}`);
    return;
  }

  console.log(`\n批次详情:`);
  console.log(`批次ID: ${batch.id}`);
  console.log(`操作人: ${batch.operator} (${batch.operatorRole})`);
  console.log(`导入时间: ${batch.importedAt.toLocaleString()}`);
  console.log(`总计: ${batch.totalCount} 本`);
  console.log(`  通过: ${batch.acceptedCount} 本`);
  console.log(`  拒绝: ${batch.rejectedCount} 本`);
  console.log(`  重复: ${batch.duplicateCount} 本`);
  console.log();
}

async function handleResults(batchId: string): Promise<void> {
  const results = await service.getBatchResults(batchId);
  if (results.length === 0) {
    console.log('该批次暂无处理结果');
    return;
  }

  console.log(`\n批次 ${batchId} 处理结果 (共 ${results.length} 条):\n`);
  results.forEach((r, index) => {
    const statusIcon = r.status === ProcessingStatus.ACCEPTED ? '✓' :
      r.status === ProcessingStatus.REJECTED ? '✗' : '→';
    console.log(`${index + 1}. ${statusIcon} [${r.status}]`);
    console.log(`   书名: ${r.input.title}`);
    console.log(`   ISBN: ${r.input.isbn || '无'}`);
    console.log(`   原因: ${r.reason}`);
    console.log(`   操作人: ${r.audit.operator} (${r.audit.operatorRole})`);
    console.log();
  });
}

async function handleShelf(batchId: string, options: CLIOptions): Promise<void> {
  const batch = await service.getBatch(batchId);
  if (!batch) {
    console.log(`未找到批次: ${batchId}`);
    return;
  }

  const shelfList = await service.generateShelfList(batchId, options.operator, options.role);

  console.log(`\n上架单生成成功!`);
  console.log(`上架单ID: ${shelfList.id}`);
  console.log(`生成时间: ${shelfList.generatedAt.toLocaleString()}`);
  console.log(`操作人: ${shelfList.operator} (${shelfList.operatorRole})`);
  console.log(`书籍总数: ${shelfList.totalCount} 本`);
  console.log(`\n上架清单:`);

  shelfList.items.forEach((item, index) => {
    console.log(`${index + 1}. [${item.shelfNumber}] ${item.title}`);
    console.log(`   ISBN: ${item.isbn || '无'}`);
    console.log(`   作者: ${item.author || '无'}`);
    console.log(`   品相: ${item.condition}`);
    console.log(`   年级: ${item.gradeLevel}`);
    console.log();
  });

  const outputPath = path.resolve(`shelf-list-${shelfList.id}.json`);
  const outputData = {
    id: shelfList.id,
    generatedAt: shelfList.generatedAt,
    operator: shelfList.operator,
    operatorRole: shelfList.operatorRole,
    batchId: shelfList.batchId,
    totalCount: shelfList.totalCount,
    items: shelfList.items,
  };
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`上架单已保存到: ${outputPath}`);
}

async function handleShelfList(): Promise<void> {
  const lists = await service.getAllShelfLists();
  if (lists.length === 0) {
    console.log('暂无上架单');
    return;
  }

  console.log(`\n共 ${lists.length} 个上架单:\n`);
  lists.forEach((list, index) => {
    console.log(`${index + 1}. 上架单ID: ${list.id}`);
    console.log(`   生成时间: ${list.generatedAt.toLocaleString()}`);
    console.log(`   操作人: ${list.operator} (${list.operatorRole})`);
    console.log(`   关联批次: ${list.batchId || '无'}`);
    console.log(`   书籍数量: ${list.totalCount} 本`);
    console.log();
  });
}

async function handleHistory(args: string[]): Promise<void> {
  const query: any = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--operator' && i + 1 < args.length) {
      query.operator = args[++i];
    } else if (args[i] === '--isbn' && i + 1 < args.length) {
      query.isbn = args[++i];
    } else if (args[i] === '--status' && i + 1 < args.length) {
      const statusMap: Record<string, ProcessingStatus> = {
        'accepted': ProcessingStatus.ACCEPTED,
        'rejected': ProcessingStatus.REJECTED,
        'duplicate': ProcessingStatus.DUPLICATE,
      };
      query.status = statusMap[args[++i]];
    }
  }

  const result = await service.getHistory(query);

  console.log(`\n历史记录 (共 ${result.total} 条):\n`);
  result.records.forEach((record, index) => {
    const statusIcon = record.status === ProcessingStatus.ACCEPTED ? '✓' :
      record.status === ProcessingStatus.REJECTED ? '✗' : '→';
    console.log(`${index + 1}. ${statusIcon} [${record.status}]`);
    console.log(`   书名: ${record.title}`);
    console.log(`   ISBN: ${record.isbn || '无'}`);
    console.log(`   原因: ${record.reason}`);
    console.log(`   操作人: ${record.operator} (${record.operatorRole})`);
    console.log(`   时间: ${record.operatedAt.toLocaleString()}`);
    console.log(`   批次ID: ${record.batchId}`);
    console.log();
  });
}

async function main(): Promise<void> {
  const { command, options, args } = parseArgs();

  try {
    switch (command) {
      case 'import':
        if (args.length === 0) {
          console.error('请指定JSON文件路径');
          printHelp();
          process.exit(1);
        }
        await handleImport(args[0], options);
        break;
      case 'batches':
        await handleBatches();
        break;
      case 'batch':
        if (args.length === 0) {
          console.error('请指定批次ID');
          process.exit(1);
        }
        await handleBatch(args[0]);
        break;
      case 'results':
        if (args.length === 0) {
          console.error('请指定批次ID');
          process.exit(1);
        }
        await handleResults(args[0]);
        break;
      case 'shelf':
        if (args.length === 0) {
          console.error('请指定批次ID');
          process.exit(1);
        }
        await handleShelf(args[0], options);
        break;
      case 'shelf-list':
        await handleShelfList();
        break;
      case 'history':
        await handleHistory(args);
        break;
      case 'help':
      default:
        printHelp();
    }
  } catch (error) {
    console.error('执行出错:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
