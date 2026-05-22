import {
  checkMissingFields,
  checkCrossDate,
  checkNameChanged,
  checkAmountConflict,
  checkQuantityConflict
} from './dirtyCheck';

describe('脏数据检测', () => {
  describe('checkMissingFields', () => {
    it('应检测缺失字段', () => {
      const data = { vin: '123', carModel: '' };
      const result = checkMissingFields(data, ['vin', 'carModel', 'date']);
      expect(result).not.toBeNull();
      expect(result?.dirtyType).toBe('missing_field');
      expect(result?.fieldName).toContain('carModel');
      expect(result?.fieldName).toContain('date');
    });

    it('无缺失字段时返回null', () => {
      const data = { vin: '123', carModel: 'Test' };
      const result = checkMissingFields(data, ['vin', 'carModel']);
      expect(result).toBeNull();
    });

    it('数值0不算缺失', () => {
      const data = { count: 0, price: 0 };
      const result = checkMissingFields(data, ['count', 'price']);
      expect(result).toBeNull();
    });
  });

  describe('checkCrossDate', () => {
    it('应检测跨期超过30天的日期', () => {
      const result = checkCrossDate('2024-01-01', '2024-03-01', 'testDate');
      expect(result).not.toBeNull();
      expect(result?.dirtyType).toBe('cross_date');
    });

    it('30天内的日期不触发', () => {
      const result = checkCrossDate('2024-01-15', '2024-02-01', 'testDate');
      expect(result).toBeNull();
    });

    it('空日期返回null', () => {
      const result = checkCrossDate('', '2024-01-01', 'testDate');
      expect(result).toBeNull();
    });
  });

  describe('checkNameChanged', () => {
    it('应检测名称变更', () => {
      const result = checkNameChanged('新名称', '旧名称', 'carModel', 'VIN123');
      expect(result).not.toBeNull();
      expect(result?.dirtyType).toBe('name_changed');
      expect(result?.originalValue).toBe('旧名称');
      expect(result?.expectedValue).toBe('新名称');
    });

    it('名称相同时返回null', () => {
      const result = checkNameChanged('同名称', '同名称', 'carModel', 'VIN123');
      expect(result).toBeNull();
    });
  });

  describe('checkAmountConflict', () => {
    it('应检测超过容差的金额冲突', () => {
      const result = checkAmountConflict(100, 150, 'price', 0.05);
      expect(result).not.toBeNull();
      expect(result?.dirtyType).toBe('amount_conflict');
    });

    it('容差范围内返回null', () => {
      const result = checkAmountConflict(100, 103, 'price', 0.05);
      expect(result).toBeNull();
    });
  });

  describe('checkQuantityConflict', () => {
    it('应检测数量不一致', () => {
      const result = checkQuantityConflict(5, 10, 'count');
      expect(result).not.toBeNull();
      expect(result?.dirtyType).toBe('quantity_conflict');
    });

    it('数量一致返回null', () => {
      const result = checkQuantityConflict(5, 5, 'count');
      expect(result).toBeNull();
    });
  });
});
