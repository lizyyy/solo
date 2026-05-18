import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { ReturnOrder, InventoryItem, InspectionResult } from './types';

export class FileReader {
  static async readReturnOrders(filePath: string): Promise<ReturnOrder[]> {
    return this.readCsvFile<ReturnOrder>(filePath, (row) => ({
      returnOrderNo: row['返厂单号'] || row['returnOrderNo'] || '',
      partCode: row['备件编码'] || row['partCode'] || '',
      partName: row['备件名称'] || row['partName'] || '',
      returnDate: row['返厂日期'] || row['returnDate'] || '',
      returnReason: row['返厂原因'] || row['returnReason'] || '',
      returnStatus: row['返厂状态'] || row['returnStatus'] || '',
      carrier: row['承运商'] || row['carrier'] || '',
      trackingNo: row['运单号'] || row['trackingNo'] || '',
      quantity: parseInt(row['数量'] || row['quantity'] || '0', 10),
    }));
  }

  static async readInventory(filePath: string): Promise<InventoryItem[]> {
    return this.readCsvFile<InventoryItem>(filePath, (row) => ({
      partCode: row['备件编码'] || row['partCode'] || '',
      partName: row['备件名称'] || row['partName'] || '',
      warehouseLocation: row['库位'] || row['warehouseLocation'] || '',
      quantity: parseInt(row['数量'] || row['quantity'] || '0', 10),
      status: row['状态'] || row['库存状态'] || row['status'] || '',
      lastUpdateDate: row['更新日期'] || row['lastUpdateDate'] || '',
    }));
  }

  static async readInspectionResults(filePath: string): Promise<InspectionResult[]> {
    return this.readCsvFile<InspectionResult>(filePath, (row) => ({
      returnOrderNo: row['返厂单号'] || row['returnOrderNo'] || '',
      partCode: row['备件编码'] || row['partCode'] || '',
      inspectionDate: row['检测日期'] || row['inspectionDate'] || '',
      inspectionResult: row['检测结果'] || row['inspectionResult'] || '',
      inspectionConclusion: row['检测结论'] || row['inspectionConclusion'] || '',
      inspector: row['检测人'] || row['inspector'] || '',
      repairStatus: row['维修状态'] || row['repairStatus'] || '',
    }));
  }

  private static async readCsvFile<T>(
    filePath: string,
    mapper: (row: Record<string, string>) => T
  ): Promise<T[]> {
    const results: T[] = [];
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${absolutePath}`);
    }

    return new Promise((resolve, reject) => {
      fs.createReadStream(absolutePath, { encoding: 'utf-8' })
        .pipe(csv())
        .on('data', (row) => {
          results.push(mapper(row));
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`读取文件失败: ${error.message}`));
        });
    });
  }
}
