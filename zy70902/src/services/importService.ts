import * as fs from 'fs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import {
  MaintenanceRecord,
  MaintenanceItem,
  SensorData,
  ApprovalRecord,
  BatchImportResult,
} from '../types';
import { dataStore } from '../store/dataStore';

export class ImportService {
  async parseMaintenanceCsv(filePath: string): Promise<MaintenanceRecord[]> {
    return new Promise((resolve, reject) => {
      const records: MaintenanceRecord[] = [];
      const cableCarMap: Map<string, any> = new Map();

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const cableCarId = row.cableCarId || row.缆车编号;
          if (!cableCarId) return;

          if (!cableCarMap.has(cableCarId)) {
            cableCarMap.set(cableCarId, {
              cableCarId,
              maintenanceDate: row.maintenanceDate || row.检修日期 || new Date().toISOString().split('T')[0],
              maintenanceType: row.maintenanceType || row.检修类型 || 'regular',
              inspector: row.inspector || row.检查员 || '',
              remarks: row.remarks || row.备注 || '',
              items: [] as MaintenanceItem[],
            });
          }

          const record = cableCarMap.get(cableCarId);
          const item: MaintenanceItem = {
            itemCode: row.itemCode || row.项目代码 || uuidv4().slice(0, 8),
            itemName: row.itemName || row.项目名称 || '',
            isKeyItem: (row.isKeyItem || row.是否关键项 || 'false').toString().toLowerCase() === 'true',
            inspectionResult: (row.inspectionResult || row.检查结果 || 'pass') as 'pass' | 'fail' | 'na',
            signedBy: row.signedBy || row.签字人 || undefined,
            signedAt: row.signedAt || row.签字时间 || undefined,
          };
          record.items.push(item);
        })
        .on('end', () => {
          for (const data of cableCarMap.values()) {
            const record = dataStore.addMaintenanceRecord(data);
            records.push(record);
          }
          resolve(records);
        })
        .on('error', reject);
    });
  }

  async parseMaintenanceCsvBuffer(buffer: Buffer): Promise<MaintenanceRecord[]> {
    return new Promise((resolve, reject) => {
      const records: MaintenanceRecord[] = [];
      const cableCarMap: Map<string, any> = new Map();

      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (row) => {
          const cableCarId = row.cableCarId || row.缆车编号;
          if (!cableCarId) return;

          if (!cableCarMap.has(cableCarId)) {
            cableCarMap.set(cableCarId, {
              cableCarId,
              maintenanceDate: row.maintenanceDate || row.检修日期 || new Date().toISOString().split('T')[0],
              maintenanceType: row.maintenanceType || row.检修类型 || 'regular',
              inspector: row.inspector || row.检查员 || '',
              remarks: row.remarks || row.备注 || '',
              items: [] as MaintenanceItem[],
            });
          }

          const record = cableCarMap.get(cableCarId);
          const item: MaintenanceItem = {
            itemCode: row.itemCode || row.项目代码 || uuidv4().slice(0, 8),
            itemName: row.itemName || row.项目名称 || '',
            isKeyItem: (row.isKeyItem || row.是否关键项 || 'false').toString().toLowerCase() === 'true',
            inspectionResult: (row.inspectionResult || row.检查结果 || 'pass') as 'pass' | 'fail' | 'na',
            signedBy: row.signedBy || row.签字人 || undefined,
            signedAt: row.signedAt || row.签字时间 || undefined,
          };
          record.items.push(item);
        })
        .on('end', () => {
          for (const data of cableCarMap.values()) {
            const record = dataStore.addMaintenanceRecord(data);
            records.push(record);
          }
          resolve(records);
        })
        .on('error', reject);
    });
  }

  async parseSensorJson(filePath: string): Promise<SensorData[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const sensorArray = Array.isArray(data) ? data : [data];
    const records: SensorData[] = [];

    for (const item of sensorArray) {
      const record = dataStore.addSensorData({
        cableCarId: item.cableCarId || item.缆车编号,
        sensorType: item.sensorType || item.传感器类型 || 'unknown',
        sensorId: item.sensorId || item.传感器ID || uuidv4().slice(0, 8),
        readings: item.readings || item.读数 || [],
        trialRunDuration: item.trialRunDuration || item.试运行时长,
        trialRunPassed: item.trialRunPassed !== undefined ? item.trialRunPassed : item.试运行是否通过,
        collectedAt: item.collectedAt || item.采集时间 || new Date().toISOString(),
      });
      records.push(record);
    }

    return records;
  }

  async parseSensorJsonBuffer(buffer: Buffer): Promise<SensorData[]> {
    const content = buffer.toString('utf-8');
    const data = JSON.parse(content);
    const sensorArray = Array.isArray(data) ? data : [data];
    const records: SensorData[] = [];

    for (const item of sensorArray) {
      const record = dataStore.addSensorData({
        cableCarId: item.cableCarId || item.缆车编号,
        sensorType: item.sensorType || item.传感器类型 || 'unknown',
        sensorId: item.sensorId || item.传感器ID || uuidv4().slice(0, 8),
        readings: item.readings || item.读数 || [],
        trialRunDuration: item.trialRunDuration || item.试运行时长,
        trialRunPassed: item.trialRunPassed !== undefined ? item.trialRunPassed : item.试运行是否通过,
        collectedAt: item.collectedAt || item.采集时间 || new Date().toISOString(),
      });
      records.push(record);
    }

    return records;
  }

  async parseApprovalCsv(filePath: string): Promise<ApprovalRecord[]> {
    return new Promise((resolve, reject) => {
      const records: ApprovalRecord[] = [];

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const record = dataStore.addApprovalRecord({
            cableCarId: row.cableCarId || row.缆车编号,
            approvalType: (row.approvalType || row.审批类型 || 'release') as 'trial_run' | 'release',
            applicant: row.applicant || row.申请人 || '',
            approver: row.approver || row.审批人 || undefined,
            approvedAt: row.approvedAt || row.审批时间 || undefined,
            status: (row.status || row.状态 || 'pending') as 'pending' | 'approved' | 'rejected',
            validFrom: row.validFrom || row.有效期开始 || undefined,
            validTo: row.validTo || row.有效期结束 || undefined,
            remarks: row.remarks || row.备注 || undefined,
            source: 'csv',
          });
          records.push(record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  async parseApprovalCsvBuffer(buffer: Buffer): Promise<ApprovalRecord[]> {
    return new Promise((resolve, reject) => {
      const records: ApprovalRecord[] = [];

      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (row) => {
          const record = dataStore.addApprovalRecord({
            cableCarId: row.cableCarId || row.缆车编号,
            approvalType: (row.approvalType || row.审批类型 || 'release') as 'trial_run' | 'release',
            applicant: row.applicant || row.申请人 || '',
            approver: row.approver || row.审批人 || undefined,
            approvedAt: row.approvedAt || row.审批时间 || undefined,
            status: (row.status || row.状态 || 'pending') as 'pending' | 'approved' | 'rejected',
            validFrom: row.validFrom || row.有效期开始 || undefined,
            validTo: row.validTo || row.有效期结束 || undefined,
            remarks: row.remarks || row.备注 || undefined,
            source: 'csv',
          });
          records.push(record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  async batchImport(
    maintenanceBuffer?: Buffer,
    sensorBuffer?: Buffer,
    approvalBuffer?: Buffer
  ): Promise<BatchImportResult> {
    let maintenanceCount = 0;
    let sensorCount = 0;
    let approvalCount = 0;

    if (maintenanceBuffer) {
      const records = await this.parseMaintenanceCsvBuffer(maintenanceBuffer);
      maintenanceCount = records.length;
    }

    if (sensorBuffer) {
      const records = await this.parseSensorJsonBuffer(sensorBuffer);
      sensorCount = records.length;
    }

    if (approvalBuffer) {
      const records = await this.parseApprovalCsvBuffer(approvalBuffer);
      approvalCount = records.length;
    }

    return dataStore.addBatchImport({
      maintenanceCount,
      sensorCount,
      approvalCount,
    });
  }
}

export const importService = new ImportService();
