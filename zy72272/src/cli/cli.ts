#!/usr/bin/env node

import { coreService } from '../core/CoreService';
import { DEMO_PHOTO_NOS, DEMO_CAD_LAYERS } from '../core/mockData';
import type { InspectionRecord } from '../../shared/types';
import { STATUS_LABELS, RECORD_TYPE_LABELS } from '../../shared/types';

interface CliArgs {
  command: string;
  options: Record<string, string>;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1] || '';
    options[key] = value;
  }

  return { command, options };
}

function printRecord(record: InspectionRecord, index: number) {
  const statusLabel = STATUS_LABELS[record.status];
  const typeLabel = RECORD_TYPE_LABELS[record.recordType];

  console.log(`\n[${index + 1}] ${record.id}`);
  console.log(`  类型: ${typeLabel}`);
  console.log(`  状态: ${statusLabel}`);
  console.log(`  巡检照片编号: ${record.photoNo || '(未导入)'}`);
  console.log(`  CAD图层名: ${record.cadLayerName || '(未补录)'}`);
  console.log(`  路线长度: ${record.routeLength !== null ? record.routeLength + ' m' : '(未计算)'}`);
  console.log(`  数据口径: ${record.caliber}`);
  console.log(`  长度已重算: ${record.lengthRecalculated ? '是' : '否'}`);
  console.log(`  含人工修正: ${record.hasManualCorrection ? '是' : '否'}`);
  console.log(`  已重跑: ${record.hasRerun ? '是' : '否'}`);
}

function printHelp() {
  console.log(`
充电站车流排队模拟 - CLI工具

用法:
  tsx src/cli/cli.ts <command> [options]

命令:
  list                列出所有记录
  import              导入演示数据（第一步）
  cad                 补录CAD图层名（第二步）
    --id <recordId>   指定记录ID（可选，默认批量处理）
    --name <name>     CAD图层名
  rerun               重跑长度计算
    --id <recordId>   指定记录ID
  correct             人工修正长度
    --id <recordId>   指定记录ID
    --length <value>  修正后的长度值
  export              导出截图（第三步）
    --output <path>   输出路径（可选）
  logs                查看操作日志
    --id <recordId>   指定记录ID（可选，不传显示所有）
  demo                一键运行完整演示流程
  reset               重置所有数据
  help                显示此帮助信息

示例:
  tsx src/cli/cli.ts import
  tsx src/cli/cli.ts cad --id REC-002 --name "LAYER-CHARGE-B"
  tsx src/cli/cli.ts logs --id REC-002
  tsx src/cli/cli.ts demo
`);
}

async function main() {
  const { command, options } = parseArgs();

  try {
    switch (command) {
      case 'list': {
        console.log('=== 记录列表 ===');
        const records = coreService.getRecords();
        if (records.length === 0) {
          console.log('暂无记录，请先运行 import 命令导入数据');
        } else {
          records.forEach((r, i) => printRecord(r, i));
        }
        break;
      }

      case 'import': {
        console.log('=== 第一步：导入巡检照片编号 ===');
        console.log('正在导入...');
        const records = await coreService.importPhotoNumbers(DEMO_PHOTO_NOS);
        console.log(`\n成功导入 ${records.length} 条记录：`);
        records.forEach((r, i) => printRecord(r, i));
        break;
      }

      case 'cad': {
        console.log('=== 第二步：补录CAD图层名 ===');
        if (options.id && options.name) {
          const record = coreService.updateCadLayerName(options.id, options.name, '老梁(CLI)');
          if (record) {
            console.log(`\n成功更新记录 ${options.id}:`);
            printRecord(record, 0);
          } else {
            console.log(`未找到记录 ${options.id}`);
          }
        } else {
          const records = coreService.getRecords();
          if (records.length === 0 || !records[0].photoNo) {
            console.log('请先运行 import 命令导入数据');
            return;
          }
          for (const record of records) {
            const cadName = DEMO_CAD_LAYERS[record.id];
            if (cadName && !record.cadLayerName) {
              coreService.updateCadLayerName(record.id, cadName, '老梁(CLI)');
              console.log(`已补录 ${record.id}: ${cadName}`);
            }
          }
          console.log('\n批量补录完成：');
          coreService.getRecords().forEach((r, i) => printRecord(r, i));
        }
        break;
      }

      case 'rerun': {
        console.log('=== 重跑长度计算 ===');
        if (!options.id) {
          console.log('请指定 --id 参数');
          return;
        }
        const record = coreService.forceRecalculate(options.id, '老梁(CLI)');
        if (record) {
          console.log(`\n成功重跑记录 ${options.id}:`);
          printRecord(record, 0);
        } else {
          console.log(`未找到记录 ${options.id}`);
        }
        break;
      }

      case 'correct': {
        console.log('=== 人工修正 ===');
        if (!options.id || !options.length) {
          console.log('请指定 --id 和 --length 参数');
          return;
        }
        const length = parseFloat(options.length);
        if (isNaN(length)) {
          console.log('长度必须是数字');
          return;
        }
        const record = coreService.manualCorrect(options.id, length, '老梁(CLI)');
        if (record) {
          console.log(`\n成功修正记录 ${options.id}:`);
          printRecord(record, 0);
        } else {
          console.log(`未找到记录 ${options.id}`);
        }
        break;
      }

      case 'export': {
        console.log('=== 第三步：导出截图 ===');
        const fileName = await coreService.exportScreenshot();
        console.log(`\n导出成功！文件名: ${fileName}`);
        if (options.output) {
          console.log(`输出路径: ${options.output}`);
        }
        break;
      }

      case 'logs': {
        console.log('=== 操作日志 ===');
        const logs = options.id
          ? coreService.getLogsByRecordId(options.id)
          : coreService.getAllLogs();

        if (logs.length === 0) {
          console.log('暂无操作日志');
        } else {
          logs.forEach((log) => {
            const time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
            console.log(`\n[${time}] ${log.operator} - ${log.action}`);
            console.log(`  记录ID: ${log.recordId}`);
            console.log(`  备注: ${log.remark}`);
            if (log.fieldName) {
              console.log(`  字段: ${log.fieldName}`);
              if (log.oldValue) console.log(`  原值: ${log.oldValue}`);
              if (log.newValue) console.log(`  新值: ${log.newValue}`);
            }
            console.log(`  日志ID: ${log.id}`);
          });
        }
        break;
      }

      case 'demo': {
        console.log('=== 一键演示完整流程 ===\n');
        const result = await coreService.runFullDemo();
        console.log('\n=== 演示完成 ===');
        console.log(`导出文件名: ${result.fileName}`);
        console.log('\n最终记录状态：');
        result.records.forEach((r, i) => printRecord(r, i));
        break;
      }

      case 'reset': {
        console.log('=== 重置数据 ===');
        coreService.reset();
        console.log('所有数据已重置');
        break;
      }

      case 'help':
      default:
        printHelp();
    }
  } catch (error) {
    console.error('\n❌ 操作出错：', (error as Error).message);
    process.exit(1);
  }
}

main();
