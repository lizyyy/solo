#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from './services/AuditService';
import { StorageService } from './storage/StorageService';
import { OutputService } from './services/OutputService';
import { AuditItem } from './types';

const program = new Command();
const auditService = new AuditService();
const storageService = new StorageService();
const outputService = new OutputService();

program
  .name('audit')
  .description('内容审核命令行工具')
  .version('1.0.0');

program
  .command('preview')
  .description('预览批量审核结果（不保存）')
  .argument('<inputFile>', '输入文件路径(JSON格式)')
  .action(async (inputFile: string) => {
    try {
      const items = loadItemsFromFile(inputFile);
      
      console.log(chalk.blue(`\n🔍 预览审核结果...\n`));
      
      const preview = await auditService.previewAudit(items);
      
      const statsTable = new Table({
        head: ['统计项', '数量'],
        colWidths: [30, 15]
      });
      
      statsTable.push(
        ['总条目数', preview.totalItems],
        ['预估通过 (✅ PASS)', preview.estimatedPass],
        ['预估拒绝 (❌ REJECT)', preview.estimatedReject],
        ['待人工审核 (⚠️ REVIEW)', preview.estimatedReview]
      );
      
      console.log(statsTable.toString());
      console.log();
      
      const detailTable = new Table({
        head: ['ID', '内容预览', '预估结果'],
        colWidths: [15, 50, 15]
      });
      
      for (const item of preview.items) {
        const contentPreview = item.item.content.slice(0, 45) + (item.item.content.length > 45 ? '...' : '');
        const resultColor = item.prediction === 'pass' ? chalk.green : 
                            item.prediction === 'reject' ? chalk.red : chalk.yellow;
        detailTable.push([
          item.item.id.slice(0, 12),
          contentPreview,
          resultColor(item.prediction.toUpperCase())
        ]);
      }
      
      console.log(detailTable.toString());
      console.log();
      
      const { duplicates, newItems } = storageService.checkDuplicates(items);
      
      if (duplicates.length > 0) {
        console.log(chalk.yellow(`⚠️  发现 ${duplicates.length} 条重复内容：`));
        for (const dup of duplicates) {
          const existingDecision = dup.existingRecord.finalDecision || dup.existingRecord.result.overallDecision;
          console.log(`   - ${dup.item.content.slice(0, 30)}... -> 已有结论: ${existingDecision.toUpperCase()}`);
        }
        console.log();
      }
      
      console.log(chalk.blue(`💡 提示: 执行 'audit run ${inputFile}' 开始正式审核\n`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('执行批量审核')
  .argument('<inputFile>', '输入文件路径(JSON格式)')
  .option('--force', '强制重新审核重复内容')
  .option('--handler <name>', '审核处理人')
  .action(async (inputFile: string, options: { force?: boolean; handler?: string }) => {
    try {
      const items = loadItemsFromFile(inputFile);
      
      console.log(chalk.blue(`\n🚀 开始审核...\n`));
      if (options.handler) {
        console.log(chalk.blue(`👤 处理人: ${options.handler}\n`));
      }
      
      const { duplicates, newItems } = storageService.checkDuplicates(items);
      
      if (duplicates.length > 0) {
        if (!options.force) {
          console.log(chalk.yellow(`⚠️  发现 ${duplicates.length} 条重复内容，跳过审核`));
          console.log(chalk.yellow(`   使用 --force 参数可强制重新审核\n`));
        } else {
          console.log(chalk.yellow(`⚠️  发现 ${duplicates.length} 条重复内容，强制重新审核`));
          const conflictTable = new Table({
            head: ['ID', '内容预览', '旧结论', '新结论', '是否冲突'],
            colWidths: [12, 35, 12, 12, 12]
          });
          
          for (const dup of duplicates) {
            const newResult = await auditService.auditItem(dup.item);
            const oldDecision = dup.existingRecord.finalDecision || dup.existingRecord.result.overallDecision;
            const isConflict = oldDecision !== newResult.overallDecision;
            const conflictStatus = isConflict ? chalk.red('是') : chalk.green('否');
            
            conflictTable.push([
              dup.item.id.slice(0, 10),
              dup.item.content.slice(0, 32) + '...',
              oldDecision.toUpperCase(),
              newResult.overallDecision.toUpperCase(),
              conflictStatus
            ]);
          }
          console.log(conflictTable.toString());
          console.log();
        }
      }
      
      const itemsToAudit = options.force ? items : newItems;
      
      if (itemsToAudit.length === 0) {
        console.log(chalk.green('✅ 没有需要审核的新内容\n'));
        return;
      }
      
      console.log(chalk.blue(`📊 正在审核 ${itemsToAudit.length} 条内容...\n`));
      
      const results = [];
      const conflicts: any[] = [];
      for (const item of itemsToAudit) {
        const result = await auditService.auditItem(item);
        
        let saveResult;
        if (options.force) {
          saveResult = storageService.forceUpdateAuditResult(result, options.handler);
          if (saveResult.isConflicting) {
            conflicts.push({
              item,
              oldDecision: saveResult.previousRecord?.finalDecision || saveResult.previousRecord?.result.overallDecision,
              newDecision: result.overallDecision
            });
          }
        } else {
          saveResult = storageService.saveAuditResult(result, options.handler);
        }
        
        results.push(result);
        
        const statusColor = result.overallDecision === 'pass' ? chalk.green : 
                           result.overallDecision === 'reject' ? chalk.red : chalk.yellow;
        console.log(`   ${statusColor(result.overallDecision.toUpperCase())} ${item.content.slice(0, 40)}...`);
      }
      
      console.log();
      
      if (conflicts.length > 0) {
        console.log(chalk.yellow(`⚠️  审核完成，发现 ${conflicts.length} 条结论冲突：`));
        for (const conflict of conflicts) {
          console.log(chalk.yellow(`   - ${conflict.item.content.slice(0, 30)}...`));
          console.log(chalk.yellow(`     原结论: ${conflict.oldDecision?.toUpperCase()} → 新结论: ${conflict.newDecision.toUpperCase()}`));
        }
        console.log();
      }
      
      console.log(chalk.green(`✅ 审核完成！共处理 ${results.length} 条内容\n`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('correct')
  .description('人工修正审核结果')
  .argument('<itemId>', '内容ID')
  .argument('<handler>', '处理人')
  .argument('<newDecision>', '新判定 (pass/reject/review)')
  .argument('<remark>', '修正备注')
  .action((itemId: string, handler: string, newDecision: string, remark: string) => {
    try {
      if (!['pass', 'reject', 'review'].includes(newDecision)) {
        throw new Error('newDecision 必须是 pass、reject 或 review');
      }
      
      const result = storageService.addManualCorrection(
        itemId,
        handler,
        newDecision as any,
        remark
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log(chalk.green(`\n✅ 人工修正已保存！\n`));
      console.log(`   处理人: ${handler}`);
      console.log(`   原判定: ${result.record?.result.overallDecision.toUpperCase()}`);
      console.log(`   新判定: ${newDecision.toUpperCase()}`);
      console.log(`   备注: ${remark}\n`);
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('confirm')
  .description('确认审核结果（无需修改时使用）')
  .argument('<itemId>', '内容ID')
  .option('--handler <name>', '确认处理人')
  .action((itemId: string, options: { handler?: string }) => {
    try {
      const result = storageService.confirmRecord(itemId, options.handler);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log(chalk.green(`\n✅ 已确认审核结果！\n`));
      console.log(`   内容ID: ${itemId}`);
      if (options.handler) {
        console.log(`   处理人: ${options.handler}`);
      }
      console.log(`   最终判定: ${result.record?.finalDecision?.toUpperCase()}\n`);
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('query')
  .description('查询审核记录')
  .option('--handler <name>', '按处理人查询')
  .option('--status <status>', '按状态查询 (pending/confirmed/corrected)')
  .option('--decision <decision>', '按判定结果查询 (pass/reject/review)')
  .option('--format <format>', '输出格式 (json/markdown)', 'markdown')
  .option('--output <path>', '输出文件路径')
  .action((options) => {
    try {
      let records = storageService.getAllRecords();
      
      if (options.handler) {
        records = storageService.queryByHandler(options.handler);
        console.log(chalk.blue(`\n🔍 查询处理人 "${options.handler}" 的记录...\n`));
      } else if (options.status) {
        records = storageService.queryByStatus(options.status as any);
        console.log(chalk.blue(`\n🔍 查询状态为 "${options.status}" 的记录...\n`));
      } else if (options.decision) {
        records = storageService.queryByDecision(options.decision as any);
        console.log(chalk.blue(`\n🔍 查询判定为 "${options.decision}" 的记录...\n`));
      } else {
        console.log(chalk.blue(`\n🔍 查询所有记录...\n`));
      }
      
      if (records.length === 0) {
        console.log(chalk.yellow('⚠️  未找到匹配的记录\n'));
        return;
      }
      
      const output = outputService.formatRecords(records, options.format);
      
      if (options.output) {
        outputService.exportRecords(records, options.format, options.output);
        console.log(chalk.green(`✅ 结果已导出到: ${options.output}\n`));
      } else {
        console.log(output);
      }
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出审核报告')
  .argument('<itemId>', '内容ID（留空则导出全部')
  .option('--format <format>', '输出格式 (json/markdown)', 'markdown')
  .option('--output <path>', '输出文件路径', './audit-report')
  .action((itemId: string | undefined, options) => {
    try {
      let records;
      
      if (itemId && itemId !== 'all') {
        const record = storageService.getRecordByItemId(itemId);
        if (!record) {
          throw new Error('未找到对应的记录');
        }
        records = [record];
        console.log(chalk.blue(`\n📤 导出记录 ${itemId}...\n`));
      } else {
        records = storageService.getAllRecords();
        console.log(chalk.blue(`\n📤 导出全部 ${records.length} 条记录...\n`));
      }
      
      outputService.exportRecords(records, options.format, options.output);
      console.log(chalk.green(`✅ 报告已导出到: ${options.output}\n`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('查看审核统计')
  .action(() => {
    const stats = storageService.getStats();
    
    console.log(chalk.blue('\n📊 审核统计\n'));
    
    const table = new Table({
      head: ['统计项', '数量'],
      colWidths: [30, 15]
    });
    
    table.push(
      ['总记录数', stats.total],
      [chalk.gray('待处理 (PENDING)'), stats.pending],
      [chalk.green('已确认 (CONFIRMED)'), stats.confirmed],
      [chalk.yellow('已修正 (CORRECTED)'), stats.corrected],
      ['---', '---'],
      [chalk.green('通过 (PASS)'), stats.pass],
      [chalk.red('拒绝 (REJECT)'), stats.reject],
      [chalk.yellow('待审核 (REVIEW)'), stats.review]
    );
    
    console.log(table.toString());
    console.log();
  });

function loadItemsFromFile(filePath: string): AuditItem[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  if (Array.isArray(data)) {
    return data.map((item: any) => ({
      id: item.id || uuidv4(),
      content: item.content,
      contentType: item.contentType || 'text',
      metadata: item.metadata
    }));
  }
  
  return [{
    id: data.id || uuidv4(),
    content: data.content,
    contentType: data.contentType || 'text',
    metadata: data.metadata
  }];
}

program.parseAsync(process.argv);
