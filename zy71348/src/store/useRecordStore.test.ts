import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRecordStore } from './useRecordStore';
import type { RecordFormData } from '@/types';

describe('useRecordStore - Integration Tests', () => {
  beforeEach(() => {
    useRecordStore.getState().clearAllData();
    localStorage.clear();
  });

  const completeData: RecordFormData = {
    catalogNumber: 'RLP001',
    albumName: 'The Dark Side of the Moon',
    artist: 'Pink Floyd',
    pressYear: '1973',
    condition: 'NM',
    consignor: '张三',
    price: 280,
    shelfLocation: 'A-01-05',
    verificationReport: '版号核对通过，品相近新，无划痕',
  };

  describe('1. 重复提交检测', () => {
    it('should reject duplicate catalog numbers', () => {
      const result1 = useRecordStore.getState().addRecord(completeData);
      expect(result1.success).toBe(true);

      const result2 = useRecordStore.getState().addRecord(completeData);
      expect(result2.success).toBe(false);
      expect(result2.errors?.[0]).toContain('已存在');
      expect(useRecordStore.getState().records).toHaveLength(1);
    });

    it('should detect duplicates after normalization', () => {
      const result1 = useRecordStore.getState().addRecord(completeData);
      expect(result1.success).toBe(true);

      const dataWithDifferentFormat = {
        ...completeData,
        catalogNumber: 'rlp 001',
      };
      const result2 = useRecordStore.getState().addRecord(dataWithDifferentFormat);
      expect(result2.success).toBe(false);
    });

    it('should allow updating existing record with same catalog number', () => {
      const result1 = useRecordStore.getState().addRecord(completeData);
      expect(result1.success).toBe(true);
      const record = result1.record!;

      const result2 = useRecordStore.getState().updateRecord(
        record.id,
        { price: 300 },
        '价格调整'
      );
      expect(result2.success).toBe(true);
      expect(useRecordStore.getState().records[0].price).toBe(300);
    });
  });

  describe('2. 缺字段处理', () => {
    it('should create draft record with missing fields', () => {
      const incompleteData = {
        ...completeData,
        price: undefined,
      };

      const result = useRecordStore.getState().addRecord(incompleteData as any);
      expect(result.success).toBe(true);
      expect(result.record?.status).toBe('draft');
      expect(useRecordStore.getState().records).toHaveLength(1);
    });

    it('should generate missing_field exceptions', () => {
      const incompleteData = {
        ...completeData,
        price: undefined,
        consignor: '',
      };

      const result = useRecordStore.getState().addRecord(incompleteData as any);
      const exceptions = useRecordStore.getState().getRecordExceptions(result.record!.id);
      const missingFieldExceptions = exceptions.filter(
        (e) => e.type === 'missing_field' && !e.resolved
      );

      expect(missingFieldExceptions).toHaveLength(2);
      expect(missingFieldExceptions.map((e) => e.field)).toEqual(
        expect.arrayContaining(['price', 'consignor'])
      );
    });

    it('should NOT allow status transition to pending with missing fields', () => {
      const incompleteData = {
        ...completeData,
        verificationReport: '',
      };
      const result = useRecordStore.getState().addRecord(incompleteData as any);
      const recordId = result.record!.id;

      const statusResult = useRecordStore.getState().updateRecordStatus(
        recordId,
        'pending',
        '提交核对'
      );
      expect(statusResult.success).toBe(false);
      expect(statusResult.errors?.[0]).toContain('字段不完整');
    });

    it('should auto-transition from draft to pending when fields are completed', () => {
      const incompleteData = {
        ...completeData,
        price: undefined,
      };
      const result = useRecordStore.getState().addRecord(incompleteData as any);
      const recordId = result.record!.id;
      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('draft');

      const updateResult = useRecordStore.getState().updateRecord(
        recordId,
        { price: 280 },
        '补充价格信息'
      );
      expect(updateResult.success).toBe(true);
      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('pending');
      expect(useRecordStore.getState().getRecordById(recordId)?.version).toBe(2);
    });
  });

  describe('3. 状态流转规则', () => {
    it('should allow draft -> pending -> verified -> listed', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('pending');

      const toVerified = useRecordStore.getState().updateRecordStatus(
        recordId,
        'verified',
        '版号核对完成'
      );
      expect(toVerified.success).toBe(true);
      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('verified');

      const toListed = useRecordStore.getState().updateRecordStatus(
        recordId,
        'listed',
        '已上架'
      );
      expect(toListed.success).toBe(true);
      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('listed');
    });

    it('should NOT allow verified -> draft (reverse transition)', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      useRecordStore.getState().updateRecordStatus(recordId, 'verified', '版号核对完成');

      const invalidTransition = useRecordStore.getState().updateRecordStatus(
        recordId,
        'draft',
        '尝试回退'
      );
      expect(invalidTransition.success).toBe(false);
      expect(invalidTransition.errors?.[0]).toContain('不允许');
      expect(useRecordStore.getState().getRecordById(recordId)?.status).toBe('verified');
    });

    it('should NOT allow pending -> draft (reverse transition)', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      const invalidTransition = useRecordStore.getState().updateRecordStatus(
        recordId,
        'draft',
        '尝试回退'
      );
      expect(invalidTransition.success).toBe(false);
    });

    it('should NOT allow modification of archived records', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      useRecordStore.getState().updateRecordStatus(recordId, 'verified', '版号核对完成');
      useRecordStore.getState().updateRecordStatus(recordId, 'archived', '归档');

      const updateResult = useRecordStore.getState().updateRecord(
        recordId,
        { price: 999 },
        '尝试修改归档记录'
      );
      expect(updateResult.success).toBe(false);
      expect(updateResult.errors?.[0]).toContain('不可修改');
    });

    it('should NOT allow modification of listed records', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      useRecordStore.getState().updateRecordStatus(recordId, 'verified', '版号核对完成');
      useRecordStore.getState().updateRecordStatus(recordId, 'listed', '已上架');

      const updateResult = useRecordStore.getState().updateRecord(
        recordId,
        { price: 999 },
        '尝试修改上架记录'
      );
      expect(updateResult.success).toBe(false);
    });
  });

  describe('4. 版号匹配与专辑组', () => {
    it('should group same album with different catalog numbers', () => {
      const result1 = useRecordStore.getState().addRecord(completeData);
      expect(result1.success).toBe(true);

      const secondVersion: RecordFormData = {
        ...completeData,
        catalogNumber: 'RLP001-RE',
        pressYear: '2015',
        price: 350,
      };
      const result2 = useRecordStore.getState().addRecord(secondVersion);
      expect(result2.success).toBe(true);

      expect(result1.record?.albumGroupId).toBeTruthy();
      expect(result1.record?.albumGroupId).toBe(result2.record?.albumGroupId);
      expect(result1.record?.versionTag).toBe('RLP001');
      expect(result2.record?.versionTag).toBe('RLP001RE v2');

      const groupRecords = useRecordStore.getState().getAlbumGroupRecords(result1.record!.albumGroupId);
      expect(groupRecords).toHaveLength(2);
    });
  });

  describe('5. 品相历史追踪', () => {
    it('should record condition changes with history', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      const conditionResult = useRecordStore.getState().updateCondition(
        recordId,
        'VG+',
        '发现细微划痕，品相调整'
      );
      expect(conditionResult.success).toBe(true);

      const history = useRecordStore.getState().getConditionHistory(recordId);
      expect(history).toHaveLength(1);
      expect(history[0].fromCondition).toBe('NM');
      expect(history[0].toCondition).toBe('VG+');
      expect(history[0].reason).toBe('发现细微划痕，品相调整');
      expect(history[0].operator).toBe('管理员');
    });

    it('should increment record version on condition change', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;
      const initialVersion = useRecordStore.getState().getRecordById(recordId)!.version;

      useRecordStore.getState().updateCondition(recordId, 'VG+', '品相调整');

      const updated = useRecordStore.getState().getRecordById(recordId)!;
      expect(updated.version).toBe(initialVersion + 1);
    });
  });

  describe('6. 价格版本管理', () => {
    it('should record price changes with history', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      const priceResult = useRecordStore.getState().updatePrice(
        recordId,
        320,
        '市场行情调整'
      );
      expect(priceResult.success).toBe(true);

      const history = useRecordStore.getState().getPriceHistory(recordId);
      expect(history).toHaveLength(1);
      expect(history[0].fromPrice).toBe(280);
      expect(history[0].toPrice).toBe(320);
      expect(history[0].reason).toBe('市场行情调整');
    });

    it('should NOT allow price <= 0', () => {
      const result = useRecordStore.getState().addRecord(completeData);
      const recordId = result.record!.id;

      const priceResult = useRecordStore.getState().updatePrice(recordId, 0, '错误价格');
      expect(priceResult.success).toBe(false);

      const priceResult2 = useRecordStore.getState().updatePrice(recordId, -50, '错误价格');
      expect(priceResult2.success).toBe(false);
    });

    it('should resolve price_anomaly exception when price is corrected', () => {
      const dataWithBadPrice = {
        ...completeData,
        price: 0,
      };
      const result = useRecordStore.getState().addRecord(dataWithBadPrice as any);
      const recordId = result.record!.id;

      const exceptions = useRecordStore.getState().getRecordExceptions(recordId);
      const priceExceptions = exceptions.filter(
        (e) => e.type === 'price_anomaly' && !e.resolved
      );
      expect(priceExceptions).toHaveLength(1);

      useRecordStore.getState().updatePrice(recordId, 280, '修正价格');

      const updatedExceptions = useRecordStore.getState().getRecordExceptions(recordId);
      const resolvedPriceExceptions = updatedExceptions.filter(
        (e) => e.type === 'price_anomaly' && e.resolved
      );
      expect(resolvedPriceExceptions).toHaveLength(1);
    });
  });

  describe('7. 导出与筛选', () => {
    it('should only export verified records', () => {
      const verifiedData: RecordFormData = {
        ...completeData,
        catalogNumber: 'RLP001',
      };
      const result1 = useRecordStore.getState().addRecord(verifiedData);
      useRecordStore.getState().updateRecordStatus(result1.record!.id, 'verified', '核对通过');

      const pendingData: RecordFormData = {
        ...completeData,
        catalogNumber: 'RLP002',
      };
      useRecordStore.getState().addRecord(pendingData);

      const exportable = useRecordStore.getState().records.filter(
        (r) => r.status === 'verified'
      );
      expect(exportable).toHaveLength(1);
      expect(exportable[0].catalogNumber).toBe('RLP001');
    });

    it('should filter records by status', () => {
      useRecordStore.getState().addRecord(completeData);
      
      const data2: RecordFormData = {
        ...completeData,
        catalogNumber: 'RLP002',
      };
      const result2 = useRecordStore.getState().addRecord(data2);
      useRecordStore.getState().updateRecordStatus(result2.record!.id, 'verified', '核对通过');

      useRecordStore.getState().setFilters({ status: ['verified'] });
      const filtered = useRecordStore.getState().getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].catalogNumber).toBe('RLP002');
    });

    it('should filter records by exception status', () => {
      useRecordStore.getState().addRecord(completeData);

      const incompleteData = {
        ...completeData,
        catalogNumber: 'RLP002',
        price: undefined,
      };
      useRecordStore.getState().addRecord(incompleteData as any);

      useRecordStore.getState().setFilters({ hasExceptions: true });
      const filtered = useRecordStore.getState().getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].catalogNumber).toBe('RLP002');
    });
  });

  describe('8. 数据持久化', () => {
    it('should persist data to localStorage', () => {
      useRecordStore.getState().addRecord(completeData);
      useRecordStore.getState().persistAll();

      const stored = localStorage.getItem('vinyl_inventory_records');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].catalogNumber).toBe('RLP001');
    });

    it('should load data from localStorage', () => {
      useRecordStore.getState().addRecord(completeData);
      useRecordStore.getState().persistAll();

      const storedData = localStorage.getItem('vinyl_inventory_records');
      expect(storedData).toBeTruthy();

      useRecordStore.getState().clearAllData();
      expect(useRecordStore.getState().records).toHaveLength(0);

      localStorage.setItem('vinyl_inventory_records', storedData!);

      useRecordStore.getState().loadFromStorage();
      expect(useRecordStore.getState().records).toHaveLength(1);
      expect(useRecordStore.getState().records[0].catalogNumber).toBe('RLP001');
    });
  });
});
