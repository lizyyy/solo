import { Command } from 'commander';
import path from 'path';
import { db } from '../database';
import { transcriptParser, sensitiveWordsParser } from '../parsers';
import { anomalyDetector } from '../detectors';
import { exporter } from '../utils/exporter';
import { CallRecord, QueryFilters } from '../types';

const program = new Command();

program
  .name('qa-cli')
  .description('客服质检系统CLI工具')
  .version('1.0.0');

program
  .command('import-transcript')
  .description('导入通话转写TXT文件')
  .argument('<filePath>', 'TXT文件路径')
  .action(async (filePath) => {
    try {
      console.log(`正在解析文件: ${filePath}`);
      const result = await transcriptParser.parseFile(filePath);
      
      let successCount = 0;
      let errorCount = result.errors.length;

      if (result.data) {
        for (const record of result.data) {
          try {
            const id = await db.insertCallRecord(record);
            successCount++;
            console.log(`  ✓ 导入通话: ${record.callId}`);
          } catch (error: any) {
            if (error.message.includes('UNIQUE constraint failed')) {
              console.log(`  ⚠ 跳过重复通话: ${record.callId}`);
            } else {
              errorCount++;
              console.log(`  ✗ 导入失败: ${record.callId} - ${error.message}`);
            }
          }
        }
      }

      for (const error of result.errors) {
        await db.insertErrorRecord(error);
        console.log(`  ✗ 错误记录: ${error.errorMessage} (${error.originalPosition})`);
      }

      await db.insertImportHistory({
        fileName: path.basename(filePath),
        fileType: 'transcript',
        totalRecords: (result.data?.length || 0) + result.errors.length,
        successCount,
        errorCount
      });

      console.log(`\n导入完成: 成功 ${successCount} 条, 错误 ${errorCount} 条`);
    } catch (error) {
      console.error('导入失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('import-sensitive')
  .description('导入敏感词表')
  .argument('<filePath>', '敏感词文件路径')
  .action(async (filePath) => {
    try {
      console.log(`正在解析敏感词文件: ${filePath}`);
      const result = await sensitiveWordsParser.parseFile(filePath);

      let successCount = 0;
      let errorCount = result.errors.length;

      if (result.data) {
        for (const word of result.data) {
          await db.insertSensitiveWord(word);
          successCount++;
          console.log(`  ✓ 导入敏感词: ${word.word} (${word.category})`);
        }
      }

      for (const error of result.errors) {
        await db.insertErrorRecord(error);
        console.log(`  ✗ 错误记录: ${error.errorMessage}`);
      }

      await db.insertImportHistory({
        fileName: path.basename(filePath),
        fileType: 'sensitive_words',
        totalRecords: (result.data?.length || 0) + result.errors.length,
        successCount,
        errorCount
      });

      console.log(`\n导入完成: 成功 ${successCount} 条, 错误 ${errorCount} 条`);
    } catch (error) {
      console.error('导入失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('detect')
  .description('对待检测的通话进行异常检测')
  .option('--all', '检测所有通话，包括已检测过的')
  .action(async (options) => {
    try {
      await anomalyDetector.init();
      
      const filters: QueryFilters = options.all ? {} : { status: 'pending' };
      const records = await db.queryCallRecords(filters);

      console.log(`找到 ${records.length} 条待检测通话\n`);

      let normalCount = 0;
      let abnormalCount = 0;

      for (const record of records) {
        console.log(`正在检测: ${record.callId} - ${record.agentName}`);
        const result = await anomalyDetector.processRecord(record as CallRecord & { id: number });
        
        if (result.status === 'normal') {
          normalCount++;
          console.log(`  ✓ 正常`);
        } else {
          abnormalCount++;
          console.log(`  ✗ 异常 - ${record.anomalies.length} 个问题`);
        }
      }

      console.log(`\n检测完成: 正常 ${normalCount} 条, 异常 ${abnormalCount} 条`);
    } catch (error) {
      console.error('检测失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('query')
  .description('查询质检结果')
  .option('--agent <name>', '按坐席姓名筛选')
  .option('--start-date <date>', '开始日期 YYYY-MM-DD')
  .option('--end-date <date>', '结束日期 YYYY-MM-DD')
  .option('--status <status>', '状态: normal/abnormal/pending')
  .option('--anomaly-type <type>', '异常类型')
  .action(async (options) => {
    try {
      const filters: QueryFilters = {};
      if (options.agent) filters.agentName = options.agent;
      if (options.startDate) filters.startDate = options.startDate;
      if (options.endDate) filters.endDate = options.endDate;
      if (options.status) filters.status = options.status;
      if (options.anomalyType) filters.anomalyType = options.anomalyType;

      const records = await db.queryCallRecords(filters);

      console.log(`查询结果: 共 ${records.length} 条记录\n`);

      records.forEach(record => {
        const statusText = record.status === 'normal' ? '正常' : record.status === 'abnormal' ? '异常' : '待检测';
        console.log(`通话ID: ${record.callId}`);
        console.log(`坐席: ${record.agentName} (${record.agentId})`);
        console.log(`日期: ${record.callDate}`);
        console.log(`状态: ${statusText}`);
        
        if (record.anomalies.length > 0) {
          console.log('异常:');
          record.anomalies.forEach(a => {
            console.log(`  - ${a.description}`);
          });
        }
        console.log('---');
      });
    } catch (error) {
      console.error('查询失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('export')
  .description('导出质检报告')
  .argument('<outputPath>', '输出文件路径')
  .option('--format <format>', '输出格式: xlsx/csv', 'xlsx')
  .option('--agent <name>', '按坐席姓名筛选')
  .option('--start-date <date>', '开始日期 YYYY-MM-DD')
  .option('--end-date <date>', '结束日期 YYYY-MM-DD')
  .option('--status <status>', '状态: normal/abnormal/pending')
  .action(async (outputPath, options) => {
    try {
      const filters: QueryFilters = {};
      if (options.agent) filters.agentName = options.agent;
      if (options.startDate) filters.startDate = options.startDate;
      if (options.endDate) filters.endDate = options.endDate;
      if (options.status) filters.status = options.status;

      const records = await db.queryCallRecords(filters);
      console.log(`找到 ${records.length} 条记录，正在导出...`);

      let resultPath: string;
      if (options.format === 'csv') {
        resultPath = await exporter.exportToCSV(records, outputPath);
      } else {
        resultPath = await exporter.exportToExcel(records, outputPath);
      }

      console.log(`导出成功: ${resultPath}`);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('errors')
  .description('查看错误记录')
  .option('--status <status>', '状态: unresolved/resolved/ignored')
  .action(async (options) => {
    try {
      const errors = await db.getErrorRecords(options.status);
      
      console.log(`错误记录: 共 ${errors.length} 条\n`);

      errors.forEach(error => {
        console.log(`ID: ${error.id}`);
        console.log(`文件: ${error.sourceFile}`);
        console.log(`位置: ${error.originalPosition}`);
        console.log(`错误类型: ${error.errorType}`);
        console.log(`错误信息: ${error.errorMessage}`);
        console.log(`建议: ${error.suggestion}`);
        console.log(`状态: ${error.status}`);
        console.log('---');
      });
    } catch (error) {
      console.error('查询失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('history')
  .description('查看导入历史')
  .action(async () => {
    try {
      const history = await db.getImportHistory();
      
      console.log(`导入历史: 共 ${history.length} 次\n`);

      history.forEach(h => {
        console.log(`文件: ${h.fileName}`);
        console.log(`类型: ${h.fileType}`);
        console.log(`总数: ${h.totalRecords}, 成功: ${h.successCount}, 错误: ${h.errorCount}`);
        console.log(`导入时间: ${h.createdAt || '未知'}`);
        console.log('---');
      });
    } catch (error) {
      console.error('查询失败:', error);
    } finally {
      await db.close();
    }
  });

program
  .command('stats')
  .description('查看统计信息')
  .action(async () => {
    try {
      const allRecords = await db.queryCallRecords({});
      const normalRecords = await db.queryCallRecords({ status: 'normal' });
      const abnormalRecords = await db.queryCallRecords({ status: 'abnormal' });
      const pendingRecords = await db.queryCallRecords({ status: 'pending' });
      const errors = await db.getErrorRecords();

      console.log('=== 质检统计 ===\n');
      console.log(`总通话数: ${allRecords.length}`);
      console.log(`正常通话: ${normalRecords.length}`);
      console.log(`异常通话: ${abnormalRecords.length}`);
      console.log(`待检测: ${pendingRecords.length}`);
      console.log(`错误记录: ${errors.length}`);
      
      if (allRecords.length > 0) {
        const anomalyRate = ((abnormalRecords.length / allRecords.length) * 100).toFixed(2);
        console.log(`异常率: ${anomalyRate}%`);
      }

      const agentStats = new Map<string, { total: number; abnormal: number }>();
      allRecords.forEach(r => {
        if (!agentStats.has(r.agentName)) {
          agentStats.set(r.agentName, { total: 0, abnormal: 0 });
        }
        agentStats.get(r.agentName)!.total++;
        if (r.status === 'abnormal') {
          agentStats.get(r.agentName)!.abnormal++;
        }
      });

      console.log('\n=== 坐席统计 ===\n');
      for (const [agent, stats] of agentStats.entries()) {
        const rate = ((stats.abnormal / stats.total) * 100).toFixed(2);
        console.log(`${agent}: 总计 ${stats.total}, 异常 ${stats.abnormal}, 异常率 ${rate}%`);
      }
    } catch (error) {
      console.error('查询失败:', error);
    } finally {
      await db.close();
    }
  });

export { program };
