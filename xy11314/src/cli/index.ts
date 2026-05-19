#!/usr/bin/env node

import { Command } from 'commander';
import { importScheduleCSV } from '../importers/scheduleImporter';
import { importGPSJSON } from '../importers/gpsImporter';
import { importComplaintCSV } from '../importers/complaintImporter';
import { matchComplaint, matchAllPendingComplaints, explainMatch } from '../matching/matcher';
import { adjudicateComplaint, adjudicateAllMatchedComplaints, reviewAdjudication, explainAdjudication } from '../adjudication/adjudicator';
import { exportAdjudications, exportBadRecords, exportAuditLogs, generateAdjudicationReport } from '../utils/exporter';
import { dao } from '../database/dao';
import { ReviewStatus } from '../types';

const program = new Command();

program
  .name('bus-scheduler')
  .description('校车调度责任判定系统')
  .version('1.0.0');

program
  .command('import-schedule')
  .description('导入站点时刻表CSV')
  .argument('<file>', 'CSV文件路径')
  .action(async (file) => {
    try {
      const result = await importScheduleCSV(file);
      console.log(`导入完成: 成功 ${result.successCount} 条, 失败 ${result.failureCount} 条`);
      if (result.failureCount > 0) {
        console.log('坏记录已保存到数据库');
      }
      process.exit(0);
    } catch (error) {
      console.error('导入失败:', error);
      process.exit(1);
    }
  });

program
  .command('import-gps')
  .description('导入GPS轨迹JSON')
  .argument('<file>', 'JSON文件路径')
  .action(async (file) => {
    try {
      const result = await importGPSJSON(file);
      console.log(`导入完成: 成功 ${result.successCount} 条, 失败 ${result.failureCount} 条`);
      process.exit(0);
    } catch (error) {
      console.error('导入失败:', error);
      process.exit(1);
    }
  });

program
  .command('import-complaint')
  .description('导入申诉单CSV')
  .argument('<file>', 'CSV文件路径')
  .action(async (file) => {
    try {
      const result = await importComplaintCSV(file);
      console.log(`导入完成: 成功 ${result.successCount} 条, 失败 ${result.failureCount} 条`);
      process.exit(0);
    } catch (error) {
      console.error('导入失败:', error);
      process.exit(1);
    }
  });

program
  .command('match')
  .description('匹配申诉数据')
  .option('--all', '匹配所有待处理申诉')
  .option('--id <number>', '匹配指定申诉ID')
  .action(async (options) => {
    try {
      if (options.all) {
        const count = await matchAllPendingComplaints();
        console.log(`匹配完成: 共处理 ${count} 条申诉`);
      } else if (options.id) {
          const match = await matchComplaint(parseInt(options.id));
          if (match) {
            console.log('匹配成功:');
            explainMatch(match).forEach(line => console.log(`  ${line}`));
          } else {
            console.log('匹配失败');
          }
      } else {
        console.log('请指定 --all 或 --id 参数');
      }
      process.exit(0);
    } catch (error) {
      console.error('匹配失败:', error);
      process.exit(1);
    }
  });

program
  .command('adjudicate')
  .description('裁定申诉责任')
  .option('--all', '裁定所有已匹配申诉')
  .option('--id <number>', '裁定指定申诉ID')
  .action(async (options) => {
    try {
      if (options.all) {
        const count = await adjudicateAllMatchedComplaints();
        console.log(`裁定完成: 共处理 ${count} 条申诉`);
      } else if (options.id) {
        const adjudication = await adjudicateComplaint(parseInt(options.id));
          if (adjudication) {
            console.log('裁定结果:');
            explainAdjudication(adjudication).forEach(line => console.log(`  ${line}`));
          } else {
            console.log('裁定失败，请先完成匹配');
          }
      } else {
        console.log('请指定 --all 或 --id 参数');
      }
      process.exit(0);
    } catch (error) {
      console.error('裁定失败:', error);
      process.exit(1);
    }
  });

program
  .command('review')
  .description('复核裁定结果')
  .requiredOption('--id <number>', '裁定ID')
  .requiredOption('--status <string>', '复核状态: confirmed 或 overturned')
  .requiredOption('--reviewer <string>', '复核人')
  .option('--notes <string>', '复核备注')
  .action(async (options) => {
    try {
      const reviewStatus = options.status as ReviewStatus;
      if (!['confirmed', 'overturned'].includes(reviewStatus)) {
        console.log('状态必须是 confirmed 或 overturned');
        process.exit(1);
      }
      await reviewAdjudication(parseInt(options.id), options.reviewer, reviewStatus, options.notes || '');
      console.log('复核完成');
      process.exit(0);
    } catch (error) {
      console.error('复核失败:', error);
      process.exit(1);
    }
  });

program
  .command('explain')
  .description('解释裁定结果')
  .requiredOption('--id <number>', '申诉ID')
  .action(async (options) => {
    try {
      const adjudication = await dao.getAdjudicationByComplaintId(parseInt(options.id));
      if (adjudication) {
        console.log('');
        explainAdjudication(adjudication).forEach(line => console.log(line));
        console.log('');
      } else {
        console.log('未找到裁定记录');
      }
      process.exit(0);
    } catch (error) {
      console.error('查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出数据')
  .requiredOption('--type <string>', '导出类型: adjudications/bad-records/audit-logs')
  .requiredOption('--output <file>', '输出文件路径')
  .option('--format <string>', '输出格式: csv/json (默认: csv)', 'csv')
  .option('--include-sensitive', '包含敏感数据')
  .action(async (options) => {
    try {
      const format: 'csv' | 'json' = options.format === 'json' ? 'json' : 'csv';
      const exportOptions = {
        format,
        includeSensitive: !!options.includeSensitive,
        userRole: (options.includeSensitive ? 'admin' : 'dispatcher') as 'admin' | 'dispatcher'
      };

      let count = 0;
      switch (options.type) {
        case 'adjudications':
          count = await exportAdjudications(exportOptions, options.output);
          break;
        case 'bad-records':
          count = await exportBadRecords(exportOptions, options.output);
          break;
        case 'audit-logs':
          count = await exportAuditLogs(exportOptions, options.output);
          break;
        default:
          console.log('未知的导出类型');
          process.exit(1);
      }
      console.log(`导出完成: 共 ${count} 条记录 -> ${options.output}`);
      process.exit(0);
    } catch (error) {
      console.error('导出失败:', error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成裁定报告')
  .requiredOption('--id <number>', '裁定ID')
  .requiredOption('--output <file>', '输出文件路径')
  .action(async (options) => {
    try {
      await generateAdjudicationReport(parseInt(options.id), options.output);
      console.log(`报告已生成: ${options.output}`);
      process.exit(0);
    } catch (error) {
      console.error('生成报告失败:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看系统状态')
  .action(async () => {
    try {
      const pending = await dao.getComplaintsByStatus('pending');
      const matched = await dao.getComplaintsByStatus('matched');
      const adjudicated = await dao.getComplaintsByStatus('adjudicated');
      const badRecords = await dao.getBadRecords();
      const adjudications = await dao.getAllAdjudications();

      console.log('');
      console.log('========== 系统状态 ==========');
      console.log('');
      console.log(`待匹配申诉:   ${pending.length} 条`);
      console.log(`已匹配申诉:   ${matched.length} 条`);
      console.log(`已裁定申诉:   ${adjudicated.length} 条`);
      console.log(`坏记录数:     ${badRecords.length} 条`);
      console.log(`裁定总数:     ${adjudications.length} 条`);
      console.log('');

      if (adjudications.length > 0) {
        const driverFault = adjudications.filter(a => a.result === 'driver_fault').length;
        const trafficFault = adjudications.filter(a => a.result === 'traffic_fault').length;
        const undetermined = adjudications.filter(a => a.result === 'undetermined').length;

        console.log('========== 裁定分布 ==========');
        console.log('');
        console.log(`司机责任:     ${driverFault} 条 (${((driverFault / adjudications.length) * 100).toFixed(1)}%)`);
        console.log(`交通原因:     ${trafficFault} 条 (${((trafficFault / adjudications.length) * 100).toFixed(1)}%)`);
        console.log(`待人工复核:   ${undetermined} 条 (${((undetermined / adjudications.length) * 100).toFixed(1)}%)`);
        console.log('');
      }

      if (badRecords.length > 0) {
        console.log('========== 最近坏记录 ==========');
        console.log('');
        badRecords.slice(0, 5).forEach((record, index) => {
          console.log(`${index + 1}. ${record.failureReason}`);
          console.log(`   建议: ${record.suggestedFix}`);
          console.log('');
        });
      }

      process.exit(0);
    } catch (error) {
      console.error('查询状态失败:', error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
