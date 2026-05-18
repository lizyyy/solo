import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { ReconciliationResult, ReconciliationRecord } from './types';

export class FileWriter {
  static async writeReconciliationResult(
    result: ReconciliationResult,
    outputPath: string
  ): Promise<void> {
    const absolutePath = path.resolve(outputPath);
    const dir = path.dirname(absolutePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
      path: absolutePath,
      header: [
        { id: 'returnOrderNo', title: '返厂单号' },
        { id: 'partCode', title: '备件编码' },
        { id: 'partName', title: '备件名称' },
        { id: 'returnDate', title: '返厂日期' },
        { id: 'returnStatus', title: '返厂状态' },
        { id: 'inventoryStatus', title: '库存状态' },
        { id: 'inspectionResult', title: '检测结果' },
        { id: 'repairStatus', title: '维修状态' },
        { id: 'reconciliationStatus', title: '对账状态' },
        { id: 'remarks', title: '备注' },
        { id: 'isAbnormal', title: '是否异常' },
      ],
    });

    const records = result.records.map((record) => ({
      ...record,
      isAbnormal: record.isAbnormal ? '是' : '否',
    }));

    await csvWriter.writeRecords(records);

    const summaryPath = absolutePath.replace('.csv', '_摘要.txt');
    await this.writeSummary(result, summaryPath);
  }

  private static async writeSummary(
    result: ReconciliationResult,
    summaryPath: string
  ): Promise<void> {
    const summary = result.summary;
    const lines = [
      '========================================',
      '    备件返厂记录维修件状态对账报告摘要',
      '========================================',
      '',
      `对账日期: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '----------------------------------------',
      '总体统计',
      '----------------------------------------',
      `总记录数: ${summary.totalRecords}`,
      `正常记录: ${summary.normalCount} (${((summary.normalCount / summary.totalRecords) * 100).toFixed(1)}%)`,
      `异常记录: ${summary.abnormalCount} (${((summary.abnormalCount / summary.totalRecords) * 100).toFixed(1)}%)`,
      '',
      '----------------------------------------',
      '异常分类明细',
      '----------------------------------------',
      `拆件维修: ${summary.breakdown.dismantleRepair} 条`,
      `检测驳回: ${summary.breakdown.inspectionRejected} 条`,
      `承运商丢件: ${summary.breakdown.carrierLost} 条`,
      `状态不一致: ${summary.breakdown.statusMismatch} 条`,
      `库存缺失: ${summary.breakdown.inventoryMissing} 条`,
      `检测缺失: ${summary.breakdown.inspectionMissing} 条`,
      '',
      '----------------------------------------',
      '异常记录清单',
      '----------------------------------------',
    ];

    const abnormalRecords = result.records.filter((r) => r.isAbnormal);
    if (abnormalRecords.length > 0) {
      for (const record of abnormalRecords) {
        lines.push(`[${record.reconciliationStatus}] ${record.returnOrderNo} - ${record.partName} (${record.partCode}): ${record.remarks}`);
      }
    } else {
      lines.push('无异常记录');
    }

    lines.push('');
    lines.push('========================================');
    lines.push('            报告生成完毕');
    lines.push('========================================');

    fs.writeFileSync(summaryPath, lines.join('\n'), { encoding: 'utf-8' });
  }
}
