import { BookingService } from '../src/services/BookingService';
import { MaterialType, BookingStatus, RecordType } from '../src/types';

describe('BookingService', () => {
  let bookingService: BookingService;

  beforeEach(() => {
    bookingService = new BookingService();
  });

  describe('单条顺延处理 - 正常场景', () => {
    it('应该成功处理正常的顺延申请', () => {
      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员',
        remarks: '正常顺延'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(BookingStatus.RAIN_POSTPONED);
      expect(result.recordType).toBe(RecordType.NORMAL);
      expect(result.validation.errors).toHaveLength(0);
    });

    it('应该正确分离正常记录和异常记录', () => {
      bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员'
      });

      const normalRecords = bookingService.getNormalRecords();
      const exceptionRecords = bookingService.getExceptionRecords();

      expect(normalRecords.length).toBeGreaterThan(0);
      expect(exceptionRecords.length).toBe(0);
    });
  });

  describe('单条顺延处理 - 半场已打完又申请整场顺延', () => {
    it('应该正确处理半场已打完又申请整场顺延的情况', () => {
      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-002',
        rainStartTime: '2024-05-18 14:30:00',
        rainEndTime: '2024-05-18 16:30:00',
        rainLevel: '中雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD, MaterialType.HALF_COURT_CONFIRM, MaterialType.CUSTOMER_SIGNATURE],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员',
        isHalfPlayed: true,
        halfPlayedDuration: 60,
        remarks: '半场已打完，申请顺延整场'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(BookingStatus.HALF_PLAYED_FULL_POSTPONED);
      expect(result.recordType).toBe(RecordType.EXCEPTION);
      expect(result.validation.nextStep).toContain('半场已打完又申请整场顺延');
    });

    it('应该提示需要补充半场使用确认书和客户签字', () => {
      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-002',
        rainStartTime: '2024-05-18 14:30:00',
        rainEndTime: '2024-05-18 16:30:00',
        rainLevel: '中雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员',
        isHalfPlayed: true,
        halfPlayedDuration: 60
      });

      expect(result.validation.requiredMaterials).toContain(MaterialType.HALF_COURT_CONFIRM);
      expect(result.validation.requiredMaterials).toContain(MaterialType.CUSTOMER_SIGNATURE);
    });
  });

  describe('重复调用测试', () => {
    it('应该拒绝重复提交的顺延申请', () => {
      const firstResult = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员'
      });

      expect(firstResult.success).toBe(true);

      const secondResult = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: ['http://example.com/weather.jpg'],
        handlerName: '管理员'
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.validation.errors).toContain('预约单 BB-20240518-001 已处理过，请勿重复提交');
    });
  });

  describe('坏数据测试', () => {
    it('应该拒绝不存在的预约单', () => {
      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-999999-999',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST],
        materialUrls: [],
        handlerName: '管理员'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('预约单不存在');
      expect(result.recordType).toBe(RecordType.EXCEPTION);
    });

    it('应该验证必填字段', () => {
      const result = bookingService.processSinglePostpone({
        bookingNo: '',
        rainStartTime: '',
        rainEndTime: '',
        rainLevel: '小雨',
        materials: [],
        materialUrls: [],
        handlerName: ''
      });

      expect(result.success).toBe(false);
      expect(result.validation.errors).toContain('预约编号不能为空');
      expect(result.validation.errors).toContain('降雨开始时间不能为空');
      expect(result.validation.errors).toContain('降雨结束时间不能为空');
      expect(result.validation.errors).toContain('至少需要提供一种证明材料');
      expect(result.validation.errors).toContain('处理人姓名不能为空');
    });
  });

  describe('状态越级测试', () => {
    it('应该拒绝已完成状态的预约单申请顺延', () => {
      const record = bookingService.getBookingRecord('BB-20240518-001');
      if (record) {
        (record as any).status = BookingStatus.COMPLETED;
      }

      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST],
        materialUrls: [],
        handlerName: '管理员'
      });

      expect(result.success).toBe(false);
      expect(result.validation.errors).toContain('已完成的预约单不能申请顺延');
    });

    it('应该拒绝已取消状态的预约单申请顺延', () => {
      const record = bookingService.getBookingRecord('BB-20240518-001');
      if (record) {
        (record as any).status = BookingStatus.CANCELLED;
      }

      const result = bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST],
        materialUrls: [],
        handlerName: '管理员'
      });

      expect(result.success).toBe(false);
      expect(result.validation.errors).toContain('已取消的预约单不能申请顺延');
    });
  });

  describe('批量补录测试', () => {
    it('应该成功处理批量顺延申请', () => {
      const result = bookingService.processBatchPostpone({
        batchNo: 'BATCH-20240518-001',
        handlerName: '管理员',
        handleTime: '2024-05-18 10:00:00',
        records: [
          {
            bookingNo: 'BB-20240518-001',
            rainStartTime: '2024-05-18 08:30:00',
            rainEndTime: '2024-05-18 11:30:00',
            rainLevel: '小雨',
            materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
            materialUrls: [],
            handlerName: '管理员'
          },
          {
            bookingNo: 'BB-20240518-002',
            rainStartTime: '2024-05-18 14:30:00',
            rainEndTime: '2024-05-18 16:30:00',
            rainLevel: '中雨',
            materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
            materialUrls: [],
            handlerName: '管理员'
          }
        ]
      });

      expect(result.batchNo).toBe('BATCH-20240518-001');
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.normalRecords.length).toBe(2);
      expect(result.exceptionRecords.length).toBe(0);
    });

    it('应该正确分离批量处理中的正常记录和异常记录', () => {
      const result = bookingService.processBatchPostpone({
        batchNo: 'BATCH-20240518-002',
        handlerName: '管理员',
        handleTime: '2024-05-18 10:00:00',
        records: [
          {
            bookingNo: 'BB-20240518-001',
            rainStartTime: '2024-05-18 08:30:00',
            rainEndTime: '2024-05-18 11:30:00',
            rainLevel: '小雨',
            materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
            materialUrls: [],
            handlerName: '管理员'
          },
          {
            bookingNo: 'BB-20240518-002',
            rainStartTime: '2024-05-18 14:30:00',
            rainEndTime: '2024-05-18 16:30:00',
            rainLevel: '中雨',
            materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD, MaterialType.HALF_COURT_CONFIRM, MaterialType.CUSTOMER_SIGNATURE],
            materialUrls: [],
            handlerName: '管理员',
            isHalfPlayed: true
          },
          {
            bookingNo: 'BB-NOT-EXIST',
            rainStartTime: '2024-05-18 08:30:00',
            rainEndTime: '2024-05-18 11:30:00',
            rainLevel: '小雨',
            materials: [MaterialType.WEATHER_FORECAST],
            materialUrls: [],
            handlerName: '管理员'
          }
        ]
      });

      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.normalRecords.length).toBe(1);
      expect(result.exceptionRecords.length).toBe(1);
    });
  });

  describe('顺延统计一致性检查', () => {
    it('应该检测出状态不匹配的不一致情况', () => {
      bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: [],
        handlerName: '管理员'
      });

      const record = bookingService.getBookingRecord('BB-20240518-001');
      if (record) {
        (record as any).status = BookingStatus.NORMAL;
      }

      const consistencyResult = bookingService.checkConsistency();

      expect(consistencyResult.isConsistent).toBe(false);
      expect(consistencyResult.inconsistencies.length).toBeGreaterThan(0);
    });

    it('应该检测出半场顺延缺少确认书的情况', () => {
      bookingService.processSinglePostpone({
        bookingNo: 'BB-20240518-002',
        rainStartTime: '2024-05-18 14:30:00',
        rainEndTime: '2024-05-18 16:30:00',
        rainLevel: '中雨',
        materials: [MaterialType.WEATHER_FORECAST, MaterialType.STAFF_RECORD],
        materialUrls: [],
        handlerName: '管理员',
        isHalfPlayed: true
      });

      const consistencyResult = bookingService.checkConsistency();

      expect(consistencyResult.isConsistent).toBe(false);
      expect(consistencyResult.inconsistencies.some(i => i.issue.includes('缺少半场使用确认书'))).toBe(true);
    });
  });

  describe('材料提示测试', () => {
    it('大雨或暴雨应该提示需要雨情报告和现场照片', () => {
      const request = {
        bookingNo: 'BB-20240518-003',
        rainStartTime: '2024-05-18 18:30:00',
        rainEndTime: '2024-05-18 20:30:00',
        rainLevel: '大雨' as const,
        materials: [MaterialType.STAFF_RECORD],
        materialUrls: [],
        handlerName: '管理员'
      };

      const validation = bookingService.validatePostponeRequest(request);

      expect(validation.requiredMaterials).toContain(MaterialType.RAIN_REPORT);
      expect(validation.requiredMaterials).toContain(MaterialType.ON_SITE_PHOTO);
    });

    it('小雨或中雨应该提示需要天气预报和工作人员记录', () => {
      const request = {
        bookingNo: 'BB-20240518-001',
        rainStartTime: '2024-05-18 08:30:00',
        rainEndTime: '2024-05-18 11:30:00',
        rainLevel: '小雨' as const,
        materials: [],
        materialUrls: [],
        handlerName: '管理员'
      };

      const validation = bookingService.validatePostponeRequest(request);

      expect(validation.requiredMaterials).toContain(MaterialType.WEATHER_FORECAST);
      expect(validation.requiredMaterials).toContain(MaterialType.STAFF_RECORD);
    });
  });

  describe('关键业务列测试', () => {
    it('应该返回关键业务列', () => {
      const keyColumns = bookingService.getKeyBusinessColumns();

      expect(keyColumns).toContain('bookingNo');
      expect(keyColumns).toContain('bookingDate');
      expect(keyColumns).toContain('courtNo');
      expect(keyColumns).toContain('courtArea');
      expect(keyColumns).toContain('courtType');
      expect(keyColumns).toContain('customerName');
      expect(keyColumns).toContain('status');
      expect(keyColumns).toContain('isRainPostponed');
      expect(keyColumns).toContain('postponeTimes');
      expect(keyColumns).toContain('rainLevel');
      expect(keyColumns).toContain('materials');
      expect(keyColumns).toContain('recordType');
      expect(keyColumns).toContain('isHalfPlayed');
    });
  });
});
