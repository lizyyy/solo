import * as fs from 'fs';
import csv from 'csv-parser';
import { dataStore } from '../store/DataStore';
import {
  ChildProfile,
  VaccineInventory,
  AppointmentRecord,
  ContraindicationRule,
  ImportResult,
  RecordStatus,
  OperationType
} from '../types';
import { Readable } from 'stream';

export class ImportService {
  async importAppointmentsFromCSV(filePath: string, batchId: string): Promise<ImportResult<AppointmentRecord>> {
    const results: any[] = [];
    const errors: string[] = [];
    let imported = 0;
    let failed = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          const importedRecords: AppointmentRecord[] = [];

          for (let i = 0; i < results.length; i++) {
            try {
              const row = results[i];
              const record = await this.processAppointmentRow(row, batchId, i + 1);
              importedRecords.push(record);
              imported++;
            } catch (error: any) {
              failed++;
              errors.push(`第 ${i + 1} 行: ${error.message}`);
            }
          }

          resolve({
            success: errors.length === 0,
            total: results.length,
            imported,
            failed,
            errors,
            data: importedRecords
          });
        })
        .on('error', (error: Error) => {
          resolve({
            success: false,
            total: 0,
            imported: 0,
            failed: 0,
            errors: [`CSV文件读取失败: ${error.message}`],
            data: []
          });
        });
    });
  }

  async importAppointmentsFromCSVString(csvContent: string, batchId: string): Promise<ImportResult<AppointmentRecord>> {
    const results: any[] = [];
    const errors: string[] = [];
    let imported = 0;
    let failed = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      stream
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          const importedRecords: AppointmentRecord[] = [];

          for (let i = 0; i < results.length; i++) {
            try {
              const row = results[i];
              const record = await this.processAppointmentRow(row, batchId, i + 1);
              importedRecords.push(record);
              imported++;
            } catch (error: any) {
              failed++;
              errors.push(`第 ${i + 1} 行: ${error.message}`);
            }
          }

          resolve({
            success: errors.length === 0,
            total: results.length,
            imported,
            failed,
            errors,
            data: importedRecords
          });
        })
        .on('error', (error: Error) => {
          resolve({
            success: false,
            total: 0,
            imported: 0,
            failed: 0,
            errors: [`CSV解析失败: ${error.message}`],
            data: []
          });
        });
    });
  }

  private async processAppointmentRow(row: any, batchId: string, rowNumber: number): Promise<AppointmentRecord> {
    const childName = row['儿童姓名'] || row['childName'];
    const childIdCard = row['身份证号'] || row['idCard'];
    const vaccineCode = row['疫苗编码'] || row['vaccineCode'];
    const vaccineName = row['疫苗名称'] || row['vaccineName'];
    const doseNumber = parseInt(row['剂次'] || row['doseNumber'] || '1');
    const appointmentDate = row['预约日期'] || row['appointmentDate'];

    if (!childName || !childIdCard || !vaccineCode) {
      throw new Error(`缺少必要字段: 儿童姓名、身份证号、疫苗编码`);
    }

    let childId: string;
    let childProfile = dataStore.getChildProfileByIdCard(childIdCard);

    if (!childProfile) {
      childProfile = dataStore.createChildProfile({
        name: childName,
        idCard: childIdCard,
        birthDate: row['出生日期'] || row['birthDate'] || '',
        gender: (row['性别'] || row['gender'] || 'male') as 'male' | 'female',
        guardianName: row['监护人姓名'] || row['guardianName'] || '',
        guardianPhone: row['监护人电话'] || row['guardianPhone'] || '',
        address: row['住址'] || row['address'] || '',
        vaccineHistory: []
      });
    }
    childId = childProfile.id;

    const record = dataStore.createAppointmentRecord({
      batchId,
      childId,
      childName,
      childIdCard,
      vaccineCode,
      vaccineName: vaccineName || '',
      doseNumber,
      appointmentDate: appointmentDate || new Date().toISOString().split('T')[0],
      status: RecordStatus.PENDING
    });

    dataStore.addOperationLog(record.id, {
      operationType: OperationType.IMPORT,
      operator: 'system',
      reason: `从CSV导入，行号: ${rowNumber}`,
      previousStatus: undefined,
      newStatus: RecordStatus.PENDING
    });

    return record;
  }

  importVaccineInventoryFromJSON(jsonContent: string): ImportResult<VaccineInventory> {
    try {
      const data = JSON.parse(jsonContent);
      const inventoryList = Array.isArray(data) ? data : [data];
      const errors: string[] = [];
      const importedInventories: VaccineInventory[] = [];

      for (let i = 0; i < inventoryList.length; i++) {
        try {
          const item = inventoryList[i];
          const inventory = dataStore.createVaccineInventory({
            vaccineCode: item.vaccineCode || item['疫苗编码'],
            vaccineName: item.vaccineName || item['疫苗名称'],
            manufacturer: item.manufacturer || item['生产厂家'] || '',
            batchNo: item.batchNo || item['批号'] || '',
            expirationDate: item.expirationDate || item['有效期'] || '',
            quantity: parseInt(item.quantity || item['数量'] || '0'),
            availableQuantity: parseInt(item.availableQuantity || item['可用数量'] || item.quantity || '0'),
            minimumAgeMonths: parseInt(item.minimumAgeMonths || item['最小月龄'] || '0'),
            intervalDays: parseInt(item.intervalDays || item['间隔天数'] || '30')
          });
          importedInventories.push(inventory);
        } catch (error: any) {
          errors.push(`第 ${i + 1} 条: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        total: inventoryList.length,
        imported: importedInventories.length,
        failed: errors.length,
        errors,
        data: importedInventories
      };
    } catch (error: any) {
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors: [`JSON解析失败: ${error.message}`],
        data: []
      };
    }
  }

  importContraindicationRules(jsonContent: string): ImportResult<ContraindicationRule> {
    try {
      const data = JSON.parse(jsonContent);
      const rulesList = Array.isArray(data) ? data : [data];
      const errors: string[] = [];
      const importedRules: ContraindicationRule[] = [];

      for (let i = 0; i < rulesList.length; i++) {
        try {
          const item = rulesList[i];
          const rule = dataStore.createContraindicationRule({
            vaccineCode: item.vaccineCode || item['疫苗编码'],
            vaccineName: item.vaccineName || item['疫苗名称'] || '',
            condition: item.condition || item['条件'],
            description: item.description || item['描述'] || '',
            severity: (item.severity || item['严重程度'] || 'medium') as 'high' | 'medium' | 'low'
          });
          importedRules.push(rule);
        } catch (error: any) {
          errors.push(`第 ${i + 1} 条: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        total: rulesList.length,
        imported: importedRules.length,
        failed: errors.length,
        errors,
        data: importedRules
      };
    } catch (error: any) {
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors: [`JSON解析失败: ${error.message}`],
        data: []
      };
    }
  }
}

export const importService = new ImportService();
