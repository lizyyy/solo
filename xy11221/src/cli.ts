#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { importService } from './services/importService';
import { qualityService } from './services/qualityService';
import { exportService } from './services/exportService';
import { createSampleExcel, createTemperatureCSV } from './sampleData';

const TODAY = new Date().toISOString().split('T')[0];

yargs(hideBin(process.argv))
  .command(
    'import',
    '导入品控数据',
    (yargs) => {
      return yargs
        .option('type', {
          alias: 't',
          type: 'string',
          describe: '导入类型: sample|temperature',
          demandOption: true
        })
        .option('file', {
          alias: 'f',
          type: 'string',
          describe: '文件路径',
          demandOption: true
        })
        .option('user', {
          alias: 'u',
          type: 'string',
          describe: '操作人',
          default: 'system'
        });
    },
    async (argv) => {
      try {
        let result;
        if (argv.type === 'sample') {
          result = await importService.importSampleRetention(argv.file, argv.user);
        } else if (argv.type === 'temperature') {
          result = await importService.importTemperatureLog(argv.file, argv.user);
        } else {
          console.error('不支持的导入类型');
          process.exit(1);
        }

        console.log(`\n导入完成!`);
        console.log(`批量ID: ${result.batchId}`);
        console.log(`总计: ${result.total} 条`);
        console.log(`成功: ${result.success} 条`);
        console.log(`失败: ${result.failed} 条`);

        if (result.failed > 0) {
          console.log(`\n失败记录详情:`);
          result.failedItems.forEach((item: any, index: number) => {
            console.log(`\n${index + 1}. 错误: ${item.error}`);
            console.log(`   建议: ${item.suggestion}`);
          });
        }
      } catch (err: any) {
        console.error('导入失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'retry',
    '重试失败的导入',
    (yargs) => {
      return yargs
        .option('import-id', {
          alias: 'i',
          type: 'string',
          describe: '导入记录ID',
          demandOption: true
        });
    },
    async (argv) => {
      try {
        const result = await importService.retryFailedImport(argv.importId);
        console.log(`\n重试完成!`);
        console.log(`总计: ${result.total} 条`);
        console.log(`成功: ${result.success} 条`);
        console.log(`失败: ${result.failed} 条`);
      } catch (err: any) {
        console.error('重试失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'review',
    '查看复核概要',
    (yargs) => {
      return yargs
        .option('date', {
          alias: 'd',
          type: 'string',
          describe: '日期 (YYYY-MM-DD)',
          default: TODAY
        });
    },
    async (argv) => {
      try {
        const summary = await qualityService.getDailyReviewSummary(argv.date);
        console.log(`\n=== ${argv.date} 品控复核概要 ===\n`);
        
        console.log('【留样记录】');
        console.log(`  总计: ${summary.sampleRetention.total} 条`);
        console.log(`  已复核: ${summary.sampleRetention.verified} 条`);
        console.log(`  待复核: ${summary.sampleRetention.pending} 条`);
        console.log(`  已废弃: ${summary.sampleRetention.discarded} 条`);
        
        console.log('\n【温度记录】');
        console.log(`  总计: ${summary.temperature.total} 条`);
        console.log(`  正常: ${summary.temperature.normal} 条`);
        console.log(`  异常: ${summary.temperature.abnormal} 条`);
        console.log(`  已复核: ${summary.temperature.verified} 条`);
        
        console.log('\n【废弃记录】');
        console.log(`  总计: ${summary.discard.total} 条`);
        console.log(`  已复核: ${summary.discard.verified} 条`);
        
        if (summary.issues.length > 0) {
          console.log('\n【需关注问题】');
          summary.issues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue}`);
          });
        }
      } catch (err: any) {
        console.error('获取复核概要失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'verify',
    '批量复核记录',
    (yargs) => {
      return yargs
        .option('type', {
          alias: 't',
          type: 'string',
          describe: '记录类型: sample|temperature',
          demandOption: true
        })
        .option('ids', {
          alias: 'i',
          type: 'string',
          describe: '记录ID列表，用逗号分隔',
          demandOption: true
        })
        .option('user', {
          alias: 'u',
          type: 'string',
          describe: '复核人',
          default: 'system'
        });
    },
    async (argv) => {
      try {
        const ids = argv.ids.split(',').map(id => id.trim());
        let result;
        
        if (argv.type === 'sample') {
          result = await qualityService.batchVerifySampleRetention(ids, argv.user);
        } else if (argv.type === 'temperature') {
          result = await qualityService.batchVerifyTemperatureLog(ids, argv.user);
        } else {
          console.error('不支持的记录类型');
          process.exit(1);
        }

        console.log(`\n复核完成!`);
        console.log(`成功: ${result.success.length} 条`);
        console.log(`失败: ${result.failed.length} 条`);

        if (result.failed.length > 0) {
          console.log(`\n失败的ID: ${result.failed.join(', ')}`);
        }
      } catch (err: any) {
        console.error('复核失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'verify-all',
    '复核所有待复核记录',
    (yargs) => {
      return yargs
        .option('user', {
          alias: 'u',
          type: 'string',
          describe: '复核人',
          default: 'system'
        });
    },
    async (argv) => {
      try {
        const pending = await qualityService.getPendingRecords();
        
        const sampleResult = await qualityService.batchVerifySampleRetention(
          pending.samples.map(s => s.id),
          argv.user
        );
        const tempResult = await qualityService.batchVerifyTemperatureLog(
          pending.temperatures.map(t => t.id),
          argv.user
        );

        console.log(`\n批量复核完成!`);
        console.log(`留样记录 - 成功: ${sampleResult.success.length}, 失败: ${sampleResult.failed.length}`);
        console.log(`温度记录 - 成功: ${tempResult.success.length}, 失败: ${tempResult.failed.length}`);
      } catch (err: any) {
        console.error('批量复核失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'export',
    '导出数据',
    (yargs) => {
      return yargs
        .option('type', {
          alias: 't',
          type: 'string',
          describe: '导出类型: sample|temperature|all|monthly|errors',
          demandOption: true
        })
        .option('start', {
          alias: 's',
          type: 'string',
          describe: '开始日期 (YYYY-MM-DD)',
          default: TODAY
        })
        .option('end', {
          alias: 'e',
          type: 'string',
          describe: '结束日期 (YYYY-MM-DD)',
          default: TODAY
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          describe: '输出目录',
          default: './data/export'
        })
        .option('import-id', {
          alias: 'i',
          type: 'string',
          describe: '导入记录ID (用于导出错误记录)'
        })
        .option('year', {
          alias: 'y',
          type: 'number',
          describe: '年份 (用于月度报告)',
          default: new Date().getFullYear()
        })
        .option('month', {
          alias: 'm',
          type: 'number',
          describe: '月份 (用于月度报告)',
          default: new Date().getMonth() + 1
        });
    },
    async (argv) => {
      try {
        let files: string[] = [];

        if (argv.type === 'sample') {
          files.push(await exportService.exportSampleRetention(argv.start, argv.end, argv.output));
        } else if (argv.type === 'temperature') {
          files.push(await exportService.exportTemperatureLog(argv.start, argv.end, argv.output));
        } else if (argv.type === 'all') {
          files = await exportService.exportAll(argv.start, argv.end, argv.output);
        } else if (argv.type === 'monthly') {
          files.push(await exportService.exportMonthlyReport(argv.year, argv.month, argv.output));
        } else if (argv.type === 'errors') {
          if (!argv.importId) {
            console.error('导出错误记录需要提供 --import-id 参数');
            process.exit(1);
          }
          files.push(await exportService.exportFailedRecords(argv.importId, argv.output));
        } else {
          console.error('不支持的导出类型');
          process.exit(1);
        }

        console.log(`\n导出完成!`);
        console.log(`生成文件:`);
        files.forEach(file => console.log(`  - ${file}`));
      } catch (err: any) {
        console.error('导出失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'pending',
    '查看待复核记录',
    async () => {
      try {
        const pending = await qualityService.getPendingRecords();
        console.log(`\n待复核记录:\n`);
        
        if (pending.samples.length > 0) {
          console.log('【留样记录】');
          pending.samples.forEach(s => {
            console.log(`  ID: ${s.id.substring(0, 8)}, 日期: ${s.date}, 菜品: ${s.dishName}, 留样人: ${s.reservedBy}`);
          });
        } else {
          console.log('【留样记录】无待复核记录');
        }
        
        if (pending.temperatures.length > 0) {
          console.log('\n【温度记录】');
          pending.temperatures.forEach(t => {
            console.log(`  ID: ${t.id.substring(0, 8)}, 日期: ${t.date}, 冰箱: ${t.refrigeratorName}, 温度: ${t.temperature}℃, 正常: ${t.isNormal ? '是' : '否'}`);
          });
        } else {
          console.log('\n【温度记录】无待复核记录');
        }
      } catch (err: any) {
        console.error('获取待复核记录失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'sample-data',
    '生成样例数据文件',
    async () => {
      try {
        const excelFile = await createSampleExcel();
        const csvFile = await createTemperatureCSV();
        console.log(`\n样例数据文件已生成:`);
        console.log(`  - ${excelFile}`);
        console.log(`  - ${csvFile}`);
        console.log(`\n可以使用以下命令导入:`);
        console.log(`  npm run dev -- import --type sample --file ${excelFile}`);
        console.log(`  npm run dev -- import --type temperature --file ${csvFile}`);
      } catch (err: any) {
        console.error('生成样例数据失败:', err.message);
        process.exit(1);
      }
    }
  )
  .command(
    'test',
    '运行完整流程测试',
    async () => {
      try {
        console.log('=== 门店品控系统测试 ===\n');
        
        console.log('1. 生成样例数据...');
        const excelFile = await createSampleExcel();
        const csvFile = await createTemperatureCSV();
        console.log('   ✓ 样例数据生成完成\n');

        console.log('2. 导入留样记录...');
        const sampleResult = await importService.importSampleRetention(excelFile, 'test_user');
        console.log(`   ✓ 导入完成 - 总计:${sampleResult.total} 成功:${sampleResult.success} 失败:${sampleResult.failed}\n`);

        console.log('3. 导入温度记录...');
        const tempResult = await importService.importTemperatureLog(csvFile, 'test_user');
        console.log(`   ✓ 导入完成 - 总计:${tempResult.total} 成功:${tempResult.success} 失败:${tempResult.failed}\n`);

        console.log('4. 查看待复核记录...');
        const pending = await qualityService.getPendingRecords();
        console.log(`   ✓ 待复核留样: ${pending.samples.length} 条`);
        console.log(`   ✓ 待复核温度: ${pending.temperatures.length} 条\n`);

        console.log('5. 批量复核所有记录...');
        const sampleVerify = await qualityService.batchVerifySampleRetention(
          pending.samples.map(s => s.id),
          'test_user'
        );
        const tempVerify = await qualityService.batchVerifyTemperatureLog(
          pending.temperatures.map(t => t.id),
          'test_user'
        );
        console.log(`   ✓ 留样复核 - 成功:${sampleVerify.success.length} 失败:${sampleVerify.failed.length}`);
        console.log(`   ✓ 温度复核 - 成功:${tempVerify.success.length} 失败:${tempVerify.failed.length}\n`);

        console.log('6. 查看复核概要...');
        const summary = await qualityService.getDailyReviewSummary(TODAY);
        console.log(`   ✓ 留样总计: ${summary.sampleRetention.total}, 已复核: ${summary.sampleRetention.verified}`);
        console.log(`   ✓ 温度总计: ${summary.temperature.total}, 已复核: ${summary.temperature.verified}\n`);

        console.log('7. 导出月度报告...');
        const reportFile = await exportService.exportMonthlyReport(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          './data/export'
        );
        console.log(`   ✓ 月度报告已导出: ${reportFile}\n`);

        console.log('=== 测试完成! 所有功能正常运行 ===');
      } catch (err: any) {
        console.error('测试失败:', err.message);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, '请提供命令')
  .help()
  .alias('h', 'help')
  .epilogue('门店品控管理系统 - 让品控追溯更简单')
  .parse();