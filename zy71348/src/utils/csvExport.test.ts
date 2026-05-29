import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCSV,
  downloadCSV,
  filterRecordsForExport,
} from './csvExport';
import type { InventoryRecord } from '@/types';

describe('csvExport', () => {
  const testRecords: InventoryRecord[] = [
    {
      id: '1',
      catalogNumber: 'RLP001',
      versionTag: 'RLP001',
      albumName: 'Test Album',
      artist: 'Test Artist',
      pressYear: '2020',
      condition: 'NM',
      consignor: '张三',
      price: 280,
      shelfLocation: 'A-01',
      verificationReport: '核对通过',
      status: 'verified',
      version: 1,
      albumGroupId: 'group1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      catalogNumber: 'RLP002',
      versionTag: 'RLP002 v2',
      albumName: 'Test Album',
      artist: 'Test Artist',
      pressYear: '2021',
      condition: 'VG+',
      consignor: '李四',
      price: 320,
      shelfLocation: 'A-02',
      verificationReport: '核对通过',
      status: 'pending',
      version: 1,
      albumGroupId: 'group1',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
    {
      id: '3',
      catalogNumber: 'RLP003',
      versionTag: 'RLP003',
      albumName: 'Another Album',
      artist: 'Another Artist',
      pressYear: '2019',
      condition: 'EX',
      consignor: '王五',
      price: 150,
      shelfLocation: 'B-01',
      verificationReport: '核对通过',
      status: 'verified',
      version: 2,
      albumGroupId: 'group2',
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
    },
  ];

  describe('filterRecordsForExport', () => {
    it('should only include verified records', () => {
      const filtered = filterRecordsForExport(testRecords);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
      expect(filtered.every((r) => r.status === 'verified')).toBe(true);
    });

    it('should return empty array if no verified records', () => {
      const pendingRecords = testRecords.filter((r) => r.status === 'pending');
      const filtered = filterRecordsForExport(pendingRecords);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('generateCSV', () => {
    it('should generate valid CSV with UTF-8 BOM', () => {
      const verifiedRecords = testRecords.filter((r) => r.status === 'verified');
      const csv = generateCSV(verifiedRecords);

      const bom = csv.charCodeAt(0);
      expect(bom).toBe(0xfeff);

      const lines = csv.substring(1).split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);

      const header = lines[0].split(',');
      expect(header).toContain('版号');
      expect(header).toContain('版本标记');
      expect(header).toContain('专辑名');
      expect(header).toContain('艺人');
      expect(header).toContain('发行年份');
      expect(header).toContain('品相');
      expect(header).toContain('寄售人');
      expect(header).toContain('寄售价格');
      expect(header).toContain('上架位置');
      expect(header).toContain('状态');
      expect(header).toContain('核对报告');
      expect(header).toContain('创建时间');
      expect(header).toContain('更新时间');
    });

    it('should handle special characters and Chinese', () => {
      const specialRecords: InventoryRecord[] = [
        {
          ...testRecords[0],
          albumName: '专辑, 带逗号',
          consignor: '张"三"',
          price: 280,
          verificationReport: '报告\n换行',
        },
      ];

      const csv = generateCSV(specialRecords);
      const dataRow = csv.substring(1).split('\n')[1];

      expect(dataRow).toContain('"专辑, 带逗号"');
      expect(dataRow).toContain('"张""三"""');
    });

    it('should handle empty array', () => {
      const csv = generateCSV([]);
      const lines = csv.substring(1).split('\n');
      expect(lines.length).toBe(1);
      expect(lines[0].split(',').length).toBeGreaterThan(5);
    });
  });

  describe('downloadCSV', () => {
    let createElementSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;
    let clickSpy: any;
    let createObjectURLSpy: any;
    let revokeObjectURLSpy: any;
    let mockLink: any;

    beforeEach(() => {
      clickSpy = vi.fn();
      mockLink = {
        href: '',
        download: '',
        style: {},
        setAttribute: (key: string, value: string) => {
          if (key === 'href') {
            mockLink.href = value;
          } else if (key === 'download') {
            mockLink.download = value;
          }
        },
        click: clickSpy,
      };
      createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockImplementation((tag: string) => {
          if (tag === 'a') {
            return mockLink as any;
          }
          return document.createElement(tag);
        });
      appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => null as any);
      removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => null as any);
      createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:test-url');
      revokeObjectURLSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should trigger download with correct filename', () => {
      const verifiedRecords = testRecords.filter(
        (r) => r.status === 'verified'
      );
      
      downloadCSV(verifiedRecords, 'test-export.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(mockLink.download).toBe('test-export.csv');
    });

    it('should generate default filename with date', () => {
      const verifiedRecords = testRecords.filter(
        (r) => r.status === 'verified'
      );

      downloadCSV(verifiedRecords);

      expect(mockLink.download).toMatch(/^黑胶上架清单_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});
