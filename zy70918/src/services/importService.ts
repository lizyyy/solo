import * as fs from 'fs';
const csv = require('csv-parser');
import { v4 as uuidv4 } from 'uuid';
import {
  ElderProfile,
  NurseSchedule,
  ServiceOrder,
  ImportResult,
  ServiceOrderStatus,
} from '../types';
import dataStore from '../store/dataStore';

export class ImportService {
  async importServiceOrdersFromCSV(filePath: string): Promise<ImportResult<ServiceOrder>> {
    const results: ServiceOrder[] = [];
    const errors: string[] = [];
    let lineNumber = 0;
    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: Record<string, string>) => {
          lineNumber++;
          try {
            const order = this.parseServiceOrder(data, lineNumber);
            if (order) results.push(order);
          } catch (e: any) {
            errors.push(`行 ${lineNumber}: ${e.message}`);
          }
        })
        .on('end', () => {
                                        sults);
          resolve({ success: errors.length === 0, data: results, errors, totalCount: lineNumber, validCount: results.length });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({ success: false, data: results, errors, totalCount: lineNumber, validCount: results.length });
        });
    });
  }

  private parseServiceOrder(data: Record<string, string>, lineNumber: number): ServiceOrder | null {
    const requiredFields = ['orderNo', 'elderId', 'elderName', 'nurseId', 'nurseName', 'serviceDate', 'serviceTime', 'serviceItems', 'actualDuration', 'status'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length > 0) throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    const statusMap: Record<string, ServiceOrderStatus> = { '已完成': 'completed', '待处理': 'pending', '已取消': 'cancelled' };
    const status = statusMap[data.status];
    if (!status) throw new Error(`无效的状态值: ${data.status}`);
    return {
      id: uuidv4(),
      orderNo: data.orderNo,
      elderId: data.elderId,
      elderName: data.elderName,
      nurseId: data.nurseId,
      nurseName: data.nurseName,
      serviceDate: data.serviceDate,
      serviceTime: data.serviceTime,
      serviceItems: (data.serviceItems || '').split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean),
      actualDuration: parseInt(data.actualDuration, 10) || 0,
      status,
      cancelReason: data.cancelReason,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      signedBy: data.signedBy,
    };
  }
}

export default new ImportService();
