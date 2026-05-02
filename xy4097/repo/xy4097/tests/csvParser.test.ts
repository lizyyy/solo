import { describe, it, expect } from 'vitest';
import { parseTimeSlotCsv, exportTimeSlotsToCsv } from '../src/parsers/csvParser';
import { TimeSlot } from '../src/types';

const validCsv = `id,startTime,endTime,visitorCount,description
TS001,09:00,10:00,50,早间时段
TS002,10:00,11:00,80,高峰时段
TS003,11:00,12:00,60,午间时段`;

const validCsvChineseHeaders = `时段ID,开始时间,结束时间,人数,说明
TS001,09:00,10:00,50,早间时段
TS002,10:00,11:00,80,高峰时段`;

describe('csvParser', () => {
  describe('parseTimeSlotCsv', () => {
    it('应该正确解析有效的 CSV 文件', () => {
      const result = parseTimeSlotCsv(validCsv);
      
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('TS001');
      expect(result[0].startTime).toBe('09:00');
      expect(result[0].endTime).toBe('10:00');
      expect(result[0].visitorCount).toBe(50);
    });

    it('应该支持中文表头', () => {
      const result = parseTimeSlotCsv(validCsvChineseHeaders);
      
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('TS001');
    });

    it('应该按开始时间排序', () => {
      const unsortedCsv = `id,startTime,endTime,visitorCount
TS003,11:00,12:00,60
TS001,09:00,10:00,50
TS002,10:00,11:00,80`;
      
      const result = parseTimeSlotCsv(unsortedCsv);
      
      expect(result[0].id).toBe('TS001');
      expect(result[1].id).toBe('TS002');
      expect(result[2].id).toBe('TS003');
    });

    it('应该抛出错误如果 CSV 格式无效', () => {
      expect(() => parseTimeSlotCsv('')).toThrow();
    });

    it('应该抛出错误如果缺少必要列', () => {
      const missingColumnCsv = `id,startTime,visitorCount
TS001,09:00,50`;
      
      expect(() => parseTimeSlotCsv(missingColumnCsv)).toThrow();
    });

    it('应该抛出错误如果访客数不是有效数字', () => {
      const invalidVisitorCountCsv = `id,startTime,endTime,visitorCount
TS001,09:00,10:00,invalid`;
      
      expect(() => parseTimeSlotCsv(invalidVisitorCountCsv)).toThrow();
    });

    it('应该抛出错误如果有重复的 ID', () => {
      const duplicateIdCsv = `id,startTime,endTime,visitorCount
TS001,09:00,10:00,50
TS001,10:00,11:00,80`;
      
      expect(() => parseTimeSlotCsv(duplicateIdCsv)).toThrow();
    });

    it('应该处理带引号的字段', () => {
      const quotedCsv = `id,startTime,endTime,visitorCount,"description"
TS001,"09:00","10:00",50,"早间, 测试"`;
      
      const result = parseTimeSlotCsv(quotedCsv);
      
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('早间, 测试');
    });
  });

  describe('exportTimeSlotsToCsv', () => {
    const testTimeSlots: TimeSlot[] = [
      {
        id: 'TS001',
        startTime: '09:00',
        endTime: '10:00',
        visitorCount: 50,
        description: '早间时段',
      },
      {
        id: 'TS002',
        startTime: '10:00',
        endTime: '11:00',
        visitorCount: 80,
        description: '高峰时段',
      },
    ];

    it('应该正确导出时段为 CSV 字符串', () => {
      const csv = exportTimeSlotsToCsv(testTimeSlots);
      
      expect(csv).toContain('TS001');
      expect(csv).toContain('TS002');
      expect(csv).toContain('09:00');
      expect(csv).toContain('50');
    });

    it('导出的 CSV 应该可以重新解析', () => {
      const exported = exportTimeSlotsToCsv(testTimeSlots);
      const reParsed = parseTimeSlotCsv(exported);
      
      expect(reParsed.length).toBe(testTimeSlots.length);
      expect(reParsed[0].id).toBe(testTimeSlots[0].id);
      expect(reParsed[0].visitorCount).toBe(testTimeSlots[0].visitorCount);
    });

    it('应该处理包含逗号的描述字段', () => {
      const slotsWithComma: TimeSlot[] = [
        {
          id: 'TS001',
          startTime: '09:00',
          endTime: '10:00',
          visitorCount: 50,
          description: '早间, 测试, 时段',
        },
      ];
      
      const exported = exportTimeSlotsToCsv(slotsWithComma);
      const reParsed = parseTimeSlotCsv(exported);
      
      expect(reParsed[0].description).toBe('早间, 测试, 时段');
    });
  });
});
