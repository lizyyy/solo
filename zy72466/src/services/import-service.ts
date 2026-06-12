import {
  ComplaintRecord,
  ComplaintStatus,
  SamplingPoint,
  ImportRowData,
  OperationType,
} from '../types';
import { dataStore } from '../store';
import { generateId, now, deepClone } from '../utils';
import { StatusManager } from './status-manager';

export class ImportService {
  static importSamplingPoint(
    rowData: ImportRowData,
    operator: string
  ): ComplaintRecord {
    const existing = dataStore
      .getAllRecords()
      .find(
        r => r.samplingPoint.pointId === rowData.pointId && !r.isDeleted
      );

    if (existing) {
      throw new Error(`采样点 ${rowData.pointId} 已存在`);
    }

    const samplingPoint: SamplingPoint = {
      pointId: rowData.pointId,
      name: rowData.pointName,
      address: rowData.address,
      district: rowData.district,
      street: rowData.street,
      lng: parseFloat(rowData.lng),
      lat: parseFloat(rowData.lat),
    };

    const emptySnapshot: ComplaintRecord = {
      id: '',
      originalRowNumber: 0,
      samplingPoint: {
        pointId: '',
        name: '',
        address: '',
        district: '',
        street: '',
        lng: 0,
        lat: 0,
      },
      currentStatus: ComplaintStatus.IMPORTED,
      statusLogs: [],
      createdAt: '',
      updatedAt: '',
      isDeleted: false,
    };

    const record: ComplaintRecord = {
      id: generateId(),
      originalRowNumber: rowData.rowNumber,
      samplingPoint,
      currentStatus: ComplaintStatus.IMPORTED,
      statusLogs: [],
      createdAt: now(),
      updatedAt: now(),
      isDeleted: false,
    };

    const importLog = StatusManager.createLogWithDiff(
      deepClone(emptySnapshot) as ComplaintRecord,
      deepClone(record) as ComplaintRecord,
      ComplaintStatus.IMPORTED,
      OperationType.IMPORT,
      operator,
      `第 ${rowData.rowNumber} 行导入，来源: 夜间采样点主材料`
    );

    record.statusLogs.push(importLog);
    dataStore.saveLog(importLog);
    dataStore.saveRecord(record);

    return record;
  }

  static batchImport(
    rows: ImportRowData[],
    operator: string
  ): {
    success: ComplaintRecord[];
    failed: { row: number; error: string }[];
  } {
    const success: ComplaintRecord[] = [];
    const failed: { row: number; error: string }[] = [];

    for (const row of rows) {
      try {
        const record = this.importSamplingPoint(row, operator);
        success.push(record);
      } catch (e) {
        failed.push({
          row: row.rowNumber,
          error: e instanceof Error ? e.message : '未知错误',
        });
      }
    }

    return { success, failed };
  }
}
