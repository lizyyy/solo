import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import {
  BoothApplication,
  LicenseAttachment,
  VenueCalendar,
  ImportResult,
  LicenseType
} from '../models/types';
import { dataStore } from '../models/store';

class ImportService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async importBoothApplications(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: []
    };

    try {
      const records = await this.parseCSV(filePath);
      
      for (const record of records) {
        try {
          const app: BoothApplication = {
            id: uuidv4(),
            applicationNo: record['申请编号'] || record['applicationNo'] || '',
            merchantName: record['商户名称'] || record['merchantName'] || '',
            contactPerson: record['联系人'] || record['contactPerson'] || '',
            contactPhone: record['联系电话'] || record['contactPhone'] || '',
            boothType: record['摊位类型'] || record['boothType'] || '',
            boothLocation: record['摊位位置'] || record['boothLocation'] || '',
            startDate: this.normalizeDate(record['开始日期'] || record['startDate'] || ''),
            endDate: this.normalizeDate(record['结束日期'] || record['endDate'] || ''),
            boothFee: parseFloat(record['摊位费用'] || record['boothFee'] || '0'),
            depositAmount: parseFloat(record['押金金额'] || record['depositAmount'] || '0'),
            status: record['状态'] || record['status'] || 'PENDING',
            appliedAt: new Date().toISOString(),
            notes: record['备注'] || record['notes']
          };

          if (!app.applicationNo || !app.merchantName) {
            result.warnings.push(`跳过记录: 申请编号或商户名称为空`);
            continue;
          }

          dataStore.addBoothApplication(app);
          result.importedCount++;
        } catch (err: any) {
          result.failedCount++;
          result.errors.push(`解析记录失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(`导入失败: ${err.message}`);
    }

    return result;
  }

  async importLicenseAttachments(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: []
    };

    try {
      const records = await this.parseCSV(filePath);
      
      for (const record of records) {
        try {
          const applicationNo = record['申请编号'] || record['applicationNo'] || '';
          const application = dataStore.getBoothApplicationsByNo(applicationNo);
          
          if (!application) {
            result.warnings.push(`未找到申请编号 ${applicationNo} 对应的摊位申请`);
            continue;
          }

          const licenseTypeMap: Record<string, LicenseType> = {
            '营业执照': LicenseType.BUSINESS_LICENSE,
            '消防合格证': LicenseType.FIRE_SAFETY,
            '食品经营许可证': LicenseType.FOOD_SAFETY,
            '其他': LicenseType.OTHER
          };

          const license: LicenseAttachment = {
            id: uuidv4(),
            applicationId: application.id,
            licenseType: licenseTypeMap[record['证照类型'] || record['licenseType'] || ''] || LicenseType.OTHER,
            licenseNo: record['证照编号'] || record['licenseNo'] || '',
            issueDate: this.normalizeDate(record['签发日期'] || record['issueDate'] || ''),
            expiryDate: this.normalizeDate(record['到期日期'] || record['expiryDate'] || ''),
            fileName: record['文件名'] || record['fileName'] || '',
            uploadTime: new Date().toISOString(),
            isVerified: (record['已验证'] || record['isVerified'] || 'false').toLowerCase() === 'true',
            notes: record['备注'] || record['notes']
          };

          dataStore.addLicenseAttachment(license);
          result.importedCount++;
        } catch (err: any) {
          result.failedCount++;
          result.errors.push(`解析记录失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(`导入失败: ${err.message}`);
    }

    return result;
  }

  async importVenueCalendar(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: []
    };

    try {
      const records = await this.parseCSV(filePath);
      
      for (const record of records) {
        try {
          const cal: VenueCalendar = {
            id: uuidv4(),
            date: this.normalizeDate(record['日期'] || record['date'] || ''),
            boothLocation: record['摊位位置'] || record['boothLocation'] || '',
            isAvailable: (record['是否可用'] || record['isAvailable'] || 'true').toLowerCase() === 'true',
            bookedApplicationId: record['已预订申请编号'] || record['bookedApplicationId'],
            bookedMerchantName: record['已预订商户名称'] || record['bookedMerchantName'],
            notes: record['备注'] || record['notes']
          };

          if (!cal.date || !cal.boothLocation) {
            result.warnings.push(`跳过记录: 日期或摊位位置为空`);
            continue;
          }

          dataStore.addVenueCalendar(cal);
          result.importedCount++;
        } catch (err: any) {
          result.failedCount++;
          result.errors.push(`解析记录失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.success = false;
      result.errors.push(`导入失败: ${err.message}`);
    }

    return result;
  }

  private parseCSV(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{4}年\d{1,2}月\d{1,2}日$/
    ];

    for (const format of formats) {
      if (format.test(dateStr)) {
        const parts = dateStr.split(/[-/年月日]/).filter(Boolean);
        if (parts.length >= 3) {
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }

    return dateStr;
  }


}

export const importService = new ImportService();
