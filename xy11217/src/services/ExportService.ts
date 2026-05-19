import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { UserRole } from '../types';
import { SampleRecordDao } from '../dao/SampleRecordDao';
import { TemperatureRecordDao } from '../dao/TemperatureRecordDao';
import { WasteRecordDao } from '../dao/WasteRecordDao';
import { DataMaskingService } from './DataMaskingService';

export class ExportService {
  private sampleDao: SampleRecordDao;
  private tempDao: TemperatureRecordDao;
  private wasteDao: WasteRecordDao;

  constructor() {
    this.sampleDao = new SampleRecordDao();
    this.tempDao = new TemperatureRecordDao();
    this.wasteDao = new WasteRecordDao();
  }

  async exportSamplesToCSV(options: {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    userRole: UserRole;
    outputPath: string;
  }): Promise<{ success: boolean; filePath: string; recordCount: number }> {
    try {
      const result = await this.sampleDao.findAll({
        storeId: options.storeId,
        startDate: options.startDate,
        endDate: options.endDate
      });

      let records = result.data;
      if (options.userRole === UserRole.STORE_MANAGER) {
        records = DataMaskingService.maskSampleRecords(records, options.userRole);
      }

      const fields = [
        'storeId', 'storeName', 'dishId', 'dishName', 'batchNo',
        'sampleTime', 'samplePerson', 'samplePersonPhone', 'expireTime',
        'storageLocation', 'status', 'reviewStatus', 'reviewTime', 'reviewer'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);

      const outputDir = path.dirname(options.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(options.outputPath, csv, 'utf8');

      return {
        success: true,
        filePath: options.outputPath,
        recordCount: records.length
      };
    } catch (err: any) {
      return { success: false, filePath: '', recordCount: 0 };
    }
  }

  async exportTemperatureToCSV(options: {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    userRole: UserRole;
    outputPath: string;
  }): Promise<{ success: boolean; filePath: string; recordCount: number }> {
    try {
      const result = await this.tempDao.findAll({
        storeId: options.storeId,
        startDate: options.startDate,
        endDate: options.endDate
      });

      let records = result.data;
      if (options.userRole === UserRole.STORE_MANAGER) {
        records = DataMaskingService.maskTemperatureRecords(records, options.userRole);
      }

      const fields = [
        'storeId', 'storeName', 'fridgeId', 'fridgeName',
        'recordTime', 'temperature', 'minTemp', 'maxTemp',
        'recordPerson', 'recordPersonPhone', 'status', 'reviewStatus', 'reviewTime', 'reviewer'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);

      const outputDir = path.dirname(options.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(options.outputPath, csv, 'utf8');

      return {
        success: true,
        filePath: options.outputPath,
        recordCount: records.length
      };
    } catch (err: any) {
      return { success: false, filePath: '', recordCount: 0 };
    }
  }

  async exportWasteToCSV(options: {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    userRole: UserRole;
    outputPath: string;
  }): Promise<{ success: boolean; filePath: string; recordCount: number }> {
    try {
      const result = await this.wasteDao.findAll({
        storeId: options.storeId,
        startDate: options.startDate,
        endDate: options.endDate
      });

      let records = result.data;
      if (options.userRole === UserRole.STORE_MANAGER) {
        records = DataMaskingService.maskWasteRecords(records, options.userRole);
      }

      const fields = [
        'storeId', 'storeName', 'dishId', 'dishName', 'batchNo',
        'wasteTime', 'wasteAmount', 'wasteReason', 'wastePerson',
        'wastePersonPhone', 'status', 'reviewStatus', 'reviewTime', 'reviewer'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);

      const outputDir = path.dirname(options.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(options.outputPath, csv, 'utf8');

      return {
        success: true,
        filePath: options.outputPath,
        recordCount: records.length
      };
    } catch (err: any) {
      return { success: false, filePath: '', recordCount: 0 };
    }
  }

  generateReportFileName(type: string, storeId?: string): string {
    const dateStr = dayjs().format('YYYYMMDD_HHmmss');
    const storePart = storeId ? `_${storeId}` : '';
    return `${type}_report${storePart}_${dateStr}.csv`;
  }
}
