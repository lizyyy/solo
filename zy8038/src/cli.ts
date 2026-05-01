#!/usr/bin/env node

import { Command } from 'commander';
import { LogParser } from './log-parser';
import { CRDTState } from './crdt-state';
import { ConflictDiagnostic } from './conflict-diagnostic';
import { ReportGenerator } from './report-generator';
import { Client, Operation, TimelineEvent, Conflict } from './types';

const program = new Command();

program
  .name('crdt-playback')
  .description('CRDT/RGA 多人编辑器操作日志回放工具')
  .version('1.0.0');

program
  .command('replay')
  .description('回放操作日志并生成输出')
  .requiredOption('-c, --clients <path>', 'clients.json 配置文件路径')
  .requiredOption('-o, --operations <path>', 'ops.jsonl 操作日志文件路径')
  .requiredOption('-i, --initial <path>', '初始文档文件路径')
  .option('-d, --document <path>', '最终文档输出路径', 'output/document.txt')
  .option('-r, --report <path>', 'Markdown报告输出路径', 'output/report.md')
  .option('-t, --timeline <path>', 'HTML时间线输出路径', 'output/timeline.html')
  .action(async (options) => {
    try {
      console.log('正在加载配置文件...');
      
      const clients = LogParser.parseClients(options.clients);
      const operations = LogParser.parseOperations(options.operations);
      const initialDocument = LogParser.readInitialDocument(options.initial);
      
      const clientMap = new Map<string, Client>();
      clients.forEach(client => clientMap.set(client.id, client));
      
      console.log(`加载完成: ${clients.length} 个客户端, ${operations.length} 个操作`);
      console.log('初始文档长度:', initialDocument.length);
      
      console.log('\n正在应用CRDT操作...');
      
      const crdtState = new CRDTState(initialDocument, clientMap);
      const timelineEvents: TimelineEvent[] = [];
      
      for (const op of operations) {
        crdtState.applyOperation(op);
        
        const client = clientMap.get(op.clientId) || { id: op.clientId, name: op.clientId, color: '#888888' };
        const conflicts = crdtState.getConflicts();
        const lastConflict = conflicts.length > 0 ? conflicts[conflicts.length - 1] : undefined;
        
        timelineEvents.push({
          operation: op,
          client,
          documentState: crdtState.getFinalDocument(),
          conflict: lastConflict && lastConflict.op.id === op.id ? lastConflict : undefined
        });
      }
      
      console.log('操作应用完成');
      
      const finalDocument = crdtState.getFinalDocument();
      const conflicts = crdtState.getConflicts();
      
      console.log('\n=== 结果汇总 ===');
      console.log('最终文档长度:', finalDocument.length);
      console.log('检测到冲突:', conflicts.length);
      console.log('  - 并发插入:', conflicts.filter(c => c.type === 'concurrent_insert').length);
      console.log('  - 无效删除:', conflicts.filter(c => c.type === 'invalid_delete').length);
      console.log('  - 撤销目标不存在:', conflicts.filter(c => c.type === 'undo_not_found').length);
      
      console.log('\n正在生成输出文件...');
      
      await ensureDirectory('output');
      
      ReportGenerator.generateFinalDocument(finalDocument, options.document);
      console.log(`最终文档: ${options.document}`);
      
      ReportGenerator.generateMarkdownReport(conflicts, clientMap, operations, options.report);
      console.log(`Markdown报告: ${options.report}`);
      
      ReportGenerator.generateHTMLTimeline(timelineEvents, clientMap, options.timeline);
      console.log(`HTML时间线: ${options.timeline}`);
      
      console.log('\n✅ 操作完成!');
      
    } catch (error) {
      console.error('❌ 错误:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function ensureDirectory(path: string): Promise<void> {
  const fs = await import('fs');
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

program.parse();
