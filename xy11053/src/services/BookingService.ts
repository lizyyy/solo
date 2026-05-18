import { cloneDeep } from 'lodash';
import {
  BookingRecord,
  BookingStatus,
  RecordType,
  MaterialType,
  PostponeRequest,
  ValidationResult,
  PostponeResponse,
  BatchPostponeRequest,
  BatchPostponeResponse,
  ConsistencyCheckResult,
  CourtType,
  CourtArea
} from '../types';

export class BookingService {
  private records: Map<string, BookingRecord> = new Map();
  private processedBookings: Set<string> = new Set();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleRecords: BookingRecord[] = [
      {
        id: '1',
        bookingNo: 'BB-20240518-001',
        bookingDate: '2024-05-18',
        bookingTimeStart: '09:00',
        bookingTimeEnd: '11:00',
        courtNo: 'A01',
        courtArea: CourtArea.NORTH,
        courtType: CourtType.FULL,
        customerName: '张三',
        customerPhone: '13800138001',
        customerId: 'CUST001',
        bookerName: '李四',
        bookerDept: '市场部',
        bookingAmount: 200,
        paymentMethod: '微信支付',
        paymentTime: '2024-05-17 15:30:00',
        status: BookingStatus.NORMAL,
        isRainPostponed: false,
        postponeTimes: 0,
        rainLevel: '小雨',
        materials: [],
        materialUrls: [],
        handlerName: '',
        handleTime: '',
        remarks: '',
        recordType: RecordType.NORMAL,
        isHalfPlayed: false,
        createTime: '2024-05-17 15:30:00',
        updateTime: '2024-05-17 15:30:00'
      },
      {
        id: '2',
        bookingNo: 'BB-20240518-002',
        bookingDate: '2024-05-18',
        bookingTimeStart: '14:00',
        bookingTimeEnd: '16:00',
        courtNo: 'B02',
        courtArea: CourtArea.SOUTH,
        courtType: CourtType.HALF,
        customerName: '王五',
        customerPhone: '13800138002',
        customerId: 'CUST002',
        bookerName: '赵六',
        bookerDept: '研发部',
        bookingAmount: 100,
        paymentMethod: '支付宝',
        paymentTime: '2024-05-17 16:00:00',
        status: BookingStatus.NORMAL,
        isRainPostponed: false,
        postponeTimes: 0,
        rainLevel: '中雨',
        materials: [],
        materialUrls: [],
        handlerName: '',
        handleTime: '',
        remarks: '',
        recordType: RecordType.NORMAL,
        isHalfPlayed: false,
        createTime: '2024-05-17 16:00:00',
        updateTime: '2024-05-17 16:00:00'
      },
      {
        id: '3',
        bookingNo: 'BB-20240518-003',
        bookingDate: '2024-05-18',
        bookingTimeStart: '18:00',
        bookingTimeEnd: '20:00',
        courtNo: 'C03',
        courtArea: CourtArea.EAST,
        courtType: CourtType.FULL,
        customerName: '孙七',
        customerPhone: '13800138003',
        customerId: 'CUST003',
        bookerName: '周八',
        bookerDept: '人事部',
        bookingAmount: 200,
        paymentMethod: '现金',
        paymentTime: '2024-05-17 17:00:00',
        status: BookingStatus.NORMAL,
        isRainPostponed: false,
        postponeTimes: 0,
        rainLevel: '大雨',
        materials: [],
        materialUrls: [],
        handlerName: '',
        handleTime: '',
        remarks: '',
        recordType: RecordType.NORMAL,
        isHalfPlayed: false,
        createTime: '2024-05-17 17:00:00',
        updateTime: '2024-05-17 17:00:00'
      }
    ];

    sampleRecords.forEach(record => {
      this.records.set(record.bookingNo, record);
    });
  }

  getBookingRecord(bookingNo: string): BookingRecord | undefined {
    return this.records.get(bookingNo);
  }

  getAllRecords(): BookingRecord[] {
    return Array.from(this.records.values());
  }

  getNormalRecords(): BookingRecord[] {
    return this.getAllRecords().filter(r => r.recordType === RecordType.NORMAL);
  }

  getExceptionRecords(): BookingRecord[] {
    return this.getAllRecords().filter(r => r.recordType === RecordType.EXCEPTION);
  }

  validatePostponeRequest(request: PostponeRequest, existingRecord?: BookingRecord): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredMaterials: MaterialType[] = [];

    if (!request.bookingNo) {
      errors.push('预约编号不能为空');
    }

    if (!request.rainStartTime) {
      errors.push('降雨开始时间不能为空');
    }

    if (!request.rainEndTime) {
      errors.push('降雨结束时间不能为空');
    }

    if (!request.rainLevel) {
      errors.push('雨量等级不能为空');
    }

    if (!request.handlerName) {
      errors.push('处理人姓名不能为空');
    }

    if (!request.materials || request.materials.length === 0) {
      errors.push('至少需要提供一种证明材料');
    }

    if (existingRecord) {
      if (this.processedBookings.has(request.bookingNo)) {
        errors.push(`预约单 ${request.bookingNo} 已处理过，请勿重复提交`);
      }

      if (existingRecord.status === BookingStatus.COMPLETED) {
        errors.push('已完成的预约单不能申请顺延');
      }

      if (existingRecord.status === BookingStatus.CANCELLED) {
        errors.push('已取消的预约单不能申请顺延');
      }

      if (existingRecord.postponeTimes >= 3) {
        errors.push('预约单顺延次数已达上限（3次）');
      }

      if (request.isHalfPlayed && existingRecord.courtType !== CourtType.HALF) {
        warnings.push('标记为"半场已打完"但原预约不是半场，请确认');
      }

      if (request.isHalfPlayed) {
        requiredMaterials.push(MaterialType.HALF_COURT_CONFIRM);
        requiredMaterials.push(MaterialType.CUSTOMER_SIGNATURE);
      }
    }

    if (request.rainLevel === '大雨' || request.rainLevel === '暴雨') {
      requiredMaterials.push(MaterialType.RAIN_REPORT);
      requiredMaterials.push(MaterialType.ON_SITE_PHOTO);
    } else {
      requiredMaterials.push(MaterialType.WEATHER_FORECAST);
      requiredMaterials.push(MaterialType.STAFF_RECORD);
    }

    const missingMaterials = requiredMaterials.filter(m => !request.materials.includes(m));

    let nextStep = '材料齐全，可正常处理顺延';
    if (missingMaterials.length > 0) {
      nextStep = `请补充以下材料：${missingMaterials.map(m => this.translateMaterialType(m)).join('、')}`;
    }

    if (request.isHalfPlayed) {
      nextStep = '半场已打完又申请整场顺延，请先核验半场使用情况，并补充半场使用确认书和客户签字';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredMaterials: missingMaterials,
      nextStep
    };
  }

  private translateMaterialType(type: MaterialType): string {
    const translations: Record<MaterialType, string> = {
      [MaterialType.RAIN_REPORT]: '雨情报告',
      [MaterialType.ON_SITE_PHOTO]: '现场照片',
      [MaterialType.CUSTOMER_SIGNATURE]: '客户签字确认',
      [MaterialType.STAFF_RECORD]: '工作人员记录',
      [MaterialType.WEATHER_FORECAST]: '天气预报截图',
      [MaterialType.HALF_COURT_CONFIRM]: '半场使用确认书'
    };
    return translations[type] || type;
  }

  processSinglePostpone(request: PostponeRequest): PostponeResponse {
    const basicValidation = this.validatePostponeRequest(request);

    if (!basicValidation.isValid && !request.bookingNo) {
      return {
        success: false,
        bookingNo: request.bookingNo,
        status: BookingStatus.EXCEPTION,
        validation: basicValidation,
        recordType: RecordType.EXCEPTION,
        message: basicValidation.errors.join('; ')
      };
    }

    const existingRecord = this.getBookingRecord(request.bookingNo);

    if (!existingRecord) {
      return {
        success: false,
        bookingNo: request.bookingNo,
        status: BookingStatus.EXCEPTION,
        validation: {
          isValid: false,
          errors: [`预约单 ${request.bookingNo} 不存在`],
          warnings: [],
          requiredMaterials: [],
          nextStep: '请检查预约编号是否正确'
        },
        recordType: RecordType.EXCEPTION,
        message: '预约单不存在'
      };
    }

    const validation = this.validatePostponeRequest(request, existingRecord);

    if (!validation.isValid) {
      return {
        success: false,
        bookingNo: request.bookingNo,
        status: existingRecord.status,
        validation,
        recordType: RecordType.EXCEPTION,
        message: validation.errors.join('; ')
      };
    }

    const isException = validation.warnings.length > 0 || 
                        request.isHalfPlayed ||
                        validation.requiredMaterials.length > 0;

    const newStatus = request.isHalfPlayed 
      ? BookingStatus.HALF_PLAYED_FULL_POSTPONED 
      : BookingStatus.RAIN_POSTPONED;

    const updatedRecord: BookingRecord = {
      ...cloneDeep(existingRecord),
      status: newStatus,
      isRainPostponed: true,
      postponeTimes: existingRecord.postponeTimes + 1,
      lastPostponeDate: new Date().toISOString().split('T')[0],
      originalBookingDate: existingRecord.originalBookingDate || existingRecord.bookingDate,
      rainStartTime: request.rainStartTime,
      rainEndTime: request.rainEndTime,
      rainLevel: request.rainLevel,
      materials: [...existingRecord.materials, ...request.materials],
      materialUrls: [...existingRecord.materialUrls, ...request.materialUrls],
      handlerName: request.handlerName,
      handleTime: new Date().toISOString(),
      remarks: request.remarks || existingRecord.remarks,
      recordType: isException ? RecordType.EXCEPTION : RecordType.NORMAL,
      exceptionReason: isException ? validation.warnings.join('; ') : undefined,
      isHalfPlayed: request.isHalfPlayed || existingRecord.isHalfPlayed,
      halfPlayedDuration: request.halfPlayedDuration || existingRecord.halfPlayedDuration,
      updateTime: new Date().toISOString()
    };

    this.records.set(request.bookingNo, updatedRecord);
    this.processedBookings.add(request.bookingNo);

    return {
      success: true,
      bookingNo: request.bookingNo,
      status: newStatus,
      validation,
      recordType: isException ? RecordType.EXCEPTION : RecordType.NORMAL,
      message: isException ? '顺延已处理，但存在异常需人工复核' : '顺延处理成功'
    };
  }

  processBatchPostpone(request: BatchPostponeRequest): BatchPostponeResponse {
    const results: PostponeResponse[] = [];
    const normalRecords: BookingRecord[] = [];
    const exceptionRecords: BookingRecord[] = [];

    request.records.forEach(recordRequest => {
      const result = this.processSinglePostpone(recordRequest);
      results.push(result);

      const updatedRecord = this.getBookingRecord(recordRequest.bookingNo);
      if (updatedRecord) {
        if (result.recordType === RecordType.NORMAL) {
          normalRecords.push(updatedRecord);
        } else {
          exceptionRecords.push(updatedRecord);
        }
      }
    });

    const successCount = results.filter(r => r.success).length;
    const exceptionCount = results.filter(r => r.recordType === RecordType.EXCEPTION).length;

    return {
      batchNo: request.batchNo,
      totalCount: request.records.length,
      successCount,
      failedCount: request.records.length - successCount,
      exceptionCount,
      normalRecords,
      exceptionRecords,
      results
    };
  }

  checkConsistency(): ConsistencyCheckResult {
    const records = this.getAllRecords();
    const inconsistencies: ConsistencyCheckResult['inconsistencies'] = [];

    records.forEach(record => {
      if (record.isRainPostponed && record.status !== BookingStatus.RAIN_POSTPONED && 
          record.status !== BookingStatus.HALF_PLAYED_FULL_POSTPONED) {
        inconsistencies.push({
          bookingNo: record.bookingNo,
          issue: '标记为已顺延但状态不匹配',
          suggestion: '请核对状态，应为"雨天顺延"或"半场打完整场顺延"'
        });
      }

      if (record.status === BookingStatus.HALF_PLAYED_FULL_POSTPONED && !record.isHalfPlayed) {
        inconsistencies.push({
          bookingNo: record.bookingNo,
          issue: '状态为"半场打完整场顺延"但未标记半场已打完',
          suggestion: '请补充半场使用确认材料'
        });
      }

      if (record.isHalfPlayed && !record.materials.includes(MaterialType.HALF_COURT_CONFIRM)) {
        inconsistencies.push({
          bookingNo: record.bookingNo,
          issue: '标记为半场已打完但缺少半场使用确认书',
          suggestion: '请补充半场使用确认书'
        });
      }

      if (record.postponeTimes > 0 && !record.lastPostponeDate) {
        inconsistencies.push({
          bookingNo: record.bookingNo,
          issue: '顺延次数大于0但缺少最后顺延日期',
          suggestion: '请补充最后顺延日期'
        });
      }

      if (record.isRainPostponed && record.materials.length === 0) {
        inconsistencies.push({
          bookingNo: record.bookingNo,
          issue: '已顺延但缺少证明材料',
          suggestion: '请至少补充雨情相关证明材料'
        });
      }
    });

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      totalRecords: records.length,
      normalCount: records.filter(r => r.recordType === RecordType.NORMAL).length,
      exceptionCount: records.filter(r => r.recordType === RecordType.EXCEPTION).length,
      postponedCount: records.filter(r => r.isRainPostponed).length,
      halfPlayedFullPostponedCount: records.filter(r => r.status === BookingStatus.HALF_PLAYED_FULL_POSTPONED).length
    };
  }

  getKeyBusinessColumns(): (keyof BookingRecord)[] {
    return [
      'bookingNo',
      'bookingDate',
      'bookingTimeStart',
      'bookingTimeEnd',
      'courtNo',
      'courtArea',
      'courtType',
      'customerName',
      'customerPhone',
      'bookerName',
      'bookerDept',
      'bookingAmount',
      'status',
      'isRainPostponed',
      'postponeTimes',
      'lastPostponeDate',
      'originalBookingDate',
      'rainStartTime',
      'rainEndTime',
      'rainLevel',
      'materials',
      'handlerName',
      'handleTime',
      'recordType',
      'exceptionReason',
      'isHalfPlayed',
      'remarks'
    ];
  }
}
