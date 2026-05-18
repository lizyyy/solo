import { createObjectCsvWriter } from 'csv-writer';
import { BookingRecord, ExportOptions } from '../types';
import { BookingService } from './BookingService';
import * as path from 'path';
import * as fs from 'fs';

export class ExportService {
  private bookingService: BookingService;
  private exportDir: string;

  constructor(bookingService: BookingService) {
    this.bookingService = bookingService;
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToCsv(options: ExportOptions): Promise<string> {
    let records = this.bookingService.getAllRecords();

    if (!options.includeNormalRecords) {
      records = records.filter(r => r.recordType !== '正常记录');
    }

    if (!options.includeExceptionRecords) {
      records = records.filter(r => r.recordType !== '异常记录');
    }

    if (options.startDate) {
      records = records.filter(r => r.bookingDate >= options.startDate!);
    }

    if (options.endDate) {
      records = records.filter(r => r.bookingDate <= options.endDate!);
    }

    if (options.statuses && options.statuses.length > 0) {
      records = records.filter(r => options.statuses!.includes(r.status));
    }

    const keyColumns = this.bookingService.getKeyBusinessColumns();
    const csvHeaders = keyColumns.map(col => ({
      id: col,
      title: this.translateColumnName(col)
    }));

    const recordsForCsv = records.map(record => {
      const csvRecord: Record<string, string> = {};
      keyColumns.forEach(col => {
        const value = record[col];
        if (Array.isArray(value)) {
          csvRecord[col] = value.join('、');
        } else if (typeof value === 'boolean') {
          csvRecord[col] = value ? '是' : '否';
        } else if (value !== undefined && value !== null) {
          csvRecord[col] = String(value);
        } else {
          csvRecord[col] = '';
        }
      });
      return csvRecord;
    });

    const fileName = `篮球场雨天顺延记录_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: csvHeaders,
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(recordsForCsv);

    return filePath;
  }

  private translateColumnName(col: keyof BookingRecord): string {
    const translations: Record<keyof BookingRecord, string> = {
      id: 'ID',
      bookingNo: '预约编号',
      bookingDate: '预约日期',
      bookingTimeStart: '开始时间',
      bookingTimeEnd: '结束时间',
      courtNo: '球场编号',
      courtArea: '球场区域',
      courtType: '球场类型',
      customerName: '客户姓名',
      customerPhone: '客户电话',
      customerId: '客户ID',
      bookerName: '订票人姓名',
      bookerDept: '订票人部门',
      bookingAmount: '预约金额',
      paymentMethod: '支付方式',
      paymentTime: '支付时间',
      status: '状态',
      isRainPostponed: '是否雨天顺延',
      postponeTimes: '顺延次数',
      lastPostponeDate: '最后顺延日期',
      originalBookingDate: '原始预约日期',
      rainStartTime: '降雨开始时间',
      rainEndTime: '降雨结束时间',
      rainLevel: '雨量等级',
      materials: '证明材料',
      materialUrls: '材料链接',
      handlerName: '处理人',
      handleTime: '处理时间',
      remarks: '备注',
      recordType: '记录类型',
      exceptionReason: '异常原因',
      isHalfPlayed: '是否半场已打完',
      halfPlayedDuration: '半场使用时长',
      createTime: '创建时间',
      updateTime: '更新时间'
    };
    return translations[col] || col;
  }
}
