import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { InventoryRecord, FailedRecord, ProcessingResult } from './types';

export const OUTPUT_COLUMNS = [
  '车辆编号',
  '回库日期',
  '药品编码',
  '药品名称',
  '批号',
  '出库数量',
  '销售数量',
  '回库数量',
  '途中报损数量',
  '报损原因',
  '拆分批号',
  '拆分后数量',
  '状态',
  '处理标记',
  '备注'
];

export const ERROR_COLUMNS = [
  ...OUTPUT_COLUMNS,
  '错误类型',
  '错误信息',
  '修复建议'
];

export class FileHandler {
  readCsvFile(filePath: string): InventoryRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    return records.map((record: any) => ({
      车辆编号: record.车辆编号 || '',
      回库日期: record.回库日期 || '',
      药品编码: record.药品编码 || '',
      药品名称: record.药品名称 || '',
      批号: record.批号 || '',
      出库数量: parseInt(record.出库数量) || 0,
      销售数量: parseInt(record.销售数量) || 0,
      回库数量: parseInt(record.回库数量) || 0,
      途中报损数量: parseInt(record.途中报损数量) || 0,
      报损原因: record.报损原因 || '',
      拆分批号: record.拆分批号 || '',
      拆分后数量: parseInt(record.拆分后数量) || 0,
      状态: record.状态 || '',
      处理标记: record.处理标记 || '',
      备注: record.备注 || ''
    }));
  }

  writeSuccessFile(filePath: string, records: InventoryRecord[]): void {
    this.ensureDirectory(filePath);
    const content = stringify(records, {
      header: true,
      columns: OUTPUT_COLUMNS
    });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  writeSkippedFile(filePath: string, records: InventoryRecord[]): void {
    this.ensureDirectory(filePath);
    const content = stringify(records, {
      header: true,
      columns: OUTPUT_COLUMNS
    });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  writeFailedFile(filePath: string, records: FailedRecord[]): void {
    this.ensureDirectory(filePath);
    const content = stringify(records, {
      header: true,
      columns: ERROR_COLUMNS
    });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  writeRerunFile(filePath: string, records: InventoryRecord[]): void {
    this.ensureDirectory(filePath);
    const content = stringify(records, {
      header: true,
      columns: OUTPUT_COLUMNS
    });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private ensureDirectory(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getOutputPaths(inputPath: string): {
    success: string;
    skipped: string;
    failed: string;
    rerun: string;
  } {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, '.csv');
    return {
      success: path.join(dir, 'output', `${name}_成功.csv`),
      skipped: path.join(dir, 'output', `${name}_跳过.csv`),
      failed: path.join(dir, 'output', `${name}_失败.csv`),
      rerun: path.join(dir, 'output', `${name}_可复跑.csv`)
    };
  }
}
