import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import {
  SubsidyRecord,
  SwipeRecord,
  RefundRecord,
  FileInfo
} from '../models/types';
import dataStore from '../store/dataStore';

export interface ImportResult<T> {
  success: boolean;
  records: T[];
  errors: string[];
  fileInfo?: FileInfo;
}

export class ImportService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  saveUploadedFile(file: Express.Multer.File, type: 'subsidy' | 'swipe' | 'refund'): string {
    const storedName = `${type}_${Date.now()}_${uuidv4()}_${file.originalname}`;
    const filePath = path.join(this.uploadDir, storedName);
    fs.writeFileSync(filePath, file.buffer);
    return storedName;
  }

  async importSubsidyJson(file: Express.Multer.File): Promise<ImportResult<SubsidyRecord>> {
    const result: ImportResult<SubsidyRecord> = {
      success: false,
      records: [],
      errors: []
    };

    try {
      const content = file.buffer.toString('utf8');
      const data = JSON.parse(content);
      const records: SubsidyRecord[] = [];
      
      const subsidyList = Array.isArray(data) ? data : data.records || data.list || [];

      for (const item of subsidyList) {
        try {
          const record = this.parseSubsidyRecord(item);
          records.push(record);
        } catch (e: any) {
          result.errors.push(`记录解析失败: ${item.studentId || '未知'} - ${e.message}`);
        }
      }

      if (records.length > 0) {
        dataStore.saveSubsidyRecords(records);
        result.records = records;
        result.success = true;
      }

      result.fileInfo = {
        originalName: file.originalname,
        storedName: this.saveUploadedFile(file, 'subsidy'),
        uploadTime: new Date(),
        recordCount: records.length,
        fileSize: file.size
      };

    } catch (e: any) {
      result.errors.push(`文件解析失败: ${e.message}`);
    }

    return result;
  }

  private parseSubsidyRecord(item: any): SubsidyRecord {
    if (!item.studentId) throw new Error('缺少学号');
    if (!item.name) throw new Error('缺少姓名');
    if (!item.monthlyLimit) throw new Error('缺少月度补贴上限');
    if (!item.effectiveMonth) throw new Error('缺少生效月份');

    return {
      id: uuidv4(),
      studentId: String(item.studentId),
      name: String(item.name),
      grade: String(item.grade || item.gradeName || ''),
      class: String(item.class || item.className || ''),
      subsidyType: String(item.subsidyType || item.type || '困难补贴'),
      monthlyLimit: Number(item.monthlyLimit),
      effectiveMonth: String(item.effectiveMonth).substring(0, 7),
      status: item.status === 'inactive' ? 'inactive' : 'active',
      remarks: item.remarks || item.comment || '',
      createdAt: new Date()
    };
  }

  async importSwipeCsv(file: Express.Multer.File): Promise<ImportResult<SwipeRecord>> {
    return new Promise((resolve) => {
      const result: ImportResult<SwipeRecord> = {
        success: false,
        records: [],
        errors: []
      };
      const records: SwipeRecord[] = [];
      let rowIndex = 0;

      const stream = fs.createReadStream(file.path || this.saveUploadedFileToTemp(file))
        .pipe(csv())
        .on('data', (data) => {
          rowIndex++;
          try {
            const record = this.parseSwipeRecord(data);
            records.push(record);
          } catch (e: any) {
            result.errors.push(`第${rowIndex}行: ${e.message}`);
          }
        })
        .on('end', () => {
          if (records.length > 0) {
            dataStore.saveSwipeRecords(records);
            result.records = records;
            result.success = true;
          }
          result.fileInfo = {
            originalName: file.originalname,
            storedName: this.saveUploadedFile(file, 'swipe'),
            uploadTime: new Date(),
            recordCount: records.length,
            fileSize: file.size
          };
          resolve(result);
        })
        .on('error', (e) => {
          result.errors.push(`文件读取失败: ${e.message}`);
          resolve(result);
        });
    });
  }

  private parseSwipeRecord(data: any): SwipeRecord {
    const studentId = data.studentId || data['学号'] || data['学生ID'];
    const name = data.name || data['姓名'];
    const swipeTime = data.swipeTime || data.time || data['刷卡时间'] || data['交易时间'];
    const amount = data.amount || data['金额'] || data['交易金额'];
    const mealType = data.mealType || data.type || data['餐别'];

    if (!studentId) throw new Error('缺少学号');
    if (!swipeTime) throw new Error('缺少刷卡时间');
    if (!amount) throw new Error('缺少交易金额');

    return {
      id: uuidv4(),
      studentId: String(studentId).trim(),
      name: String(name || '').trim(),
      grade: String(data.grade || data['年级'] || '').trim(),
      class: String(data.class || data['班级'] || '').trim(),
      swipeTime: new Date(swipeTime),
      amount: Number(amount),
      mealType: this.parseMealType(mealType),
      merchantName: String(data.merchant || data.merchantName || data['商户'] || '食堂').trim(),
      terminalNo: String(data.terminal || data.terminalNo || data['终端号'] || '').trim(),
      isSubsidyUsed: (data.subsidyUsed || data['使用补贴']) === '是' || 
                      data.subsidyUsed === true ||
                      Number(data.subsidyAmount || data['补贴金额'] || 0) > 0
    };
  }

  private parseMealType(type: string): 'breakfast' | 'lunch' | 'dinner' | 'other' {
    const t = String(type || '').toLowerCase();
    if (t.includes('早餐') || t === 'breakfast') return 'breakfast';
    if (t.includes('午餐') || t.includes('中餐') || t === 'lunch') return 'lunch';
    if (t.includes('晚餐') || t === 'dinner') return 'dinner';
    return 'other';
  }

  async importRefundCsv(file: Express.Multer.File): Promise<ImportResult<RefundRecord>> {
    return new Promise((resolve) => {
      const result: ImportResult<RefundRecord> = {
        success: false,
        records: [],
        errors: []
      };
      const records: RefundRecord[] = [];
      let rowIndex = 0;

      const stream = fs.createReadStream(file.path || this.saveUploadedFileToTemp(file))
        .pipe(csv())
        .on('data', (data) => {
          rowIndex++;
          try {
            const record = this.parseRefundRecord(data);
            records.push(record);
          } catch (e: any) {
            result.errors.push(`第${rowIndex}行: ${e.message}`);
          }
        })
        .on('end', () => {
          if (records.length > 0) {
            dataStore.saveRefundRecords(records);
            result.records = records;
            result.success = true;
          }
          result.fileInfo = {
            originalName: file.originalname,
            storedName: this.saveUploadedFile(file, 'refund'),
            uploadTime: new Date(),
            recordCount: records.length,
            fileSize: file.size
          };
          resolve(result);
        })
        .on('error', (e) => {
          result.errors.push(`文件读取失败: ${e.message}`);
          resolve(result);
        });
    });
  }

  private parseRefundRecord(data: any): RefundRecord {
    const studentId = data.studentId || data['学号'] || data['学生ID'];
    const refundDate = data.refundDate || data.date || data['退款日期'];
    const refundAmount = data.refundAmount || data.amount || data['退款金额'];
    const reason = data.reason || data['退款原因'] || '';

    if (!studentId) throw new Error('缺少学号');
    if (!refundDate) throw new Error('缺少退款日期');
    if (!refundAmount) throw new Error('缺少退款金额');

    return {
      id: uuidv4(),
      studentId: String(studentId).trim(),
      name: String(data.name || data['姓名'] || '').trim(),
      grade: String(data.grade || data['年级'] || '').trim(),
      class: String(data.class || data['班级'] || '').trim(),
      refundDate: new Date(refundDate),
      refundAmount: Number(refundAmount),
      reason: String(reason).trim(),
      relatedSwipeId: data.relatedSwipeId || data['关联刷卡ID'] || undefined,
      operator: String(data.operator || data['操作员'] || '系统导入').trim(),
      status: 'processed'
    };
  }

  private saveUploadedFileToTemp(file: Express.Multer.File): string {
    const tempPath = path.join(this.uploadDir, `temp_${uuidv4()}.csv`);
    if (file.buffer) {
      fs.writeFileSync(tempPath, file.buffer);
      return tempPath;
    }
    return file.path || tempPath;
  }
}

export default new ImportService();
