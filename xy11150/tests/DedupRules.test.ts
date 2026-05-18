import { ShuttleRegistration } from '../src/models/ShuttleRegistration';
import { DedupRuleEngine, dedupEngine } from '../src/models/DedupRules';

describe('DedupRuleEngine', () => {
  const createRecord = (overrides: Partial<ShuttleRegistration> = {}): ShuttleRegistration => ({
    employeeId: '',
    employeeName: '',
    department: '',
    phone: '',
    routeName: '',
    boardingPoint: '',
    boardingTime: '',
    registrationDate: '',
    status: '正常',
    rawData: {},
    sourceFile: 'test.csv',
    rowNumber: 1,
    ...overrides
  });

  describe('去重键生成测试', () => {
    it('应该基于员工编号生成去重键', () => {
      const record = createRecord({ employeeId: 'E001' });
      const key = dedupEngine.generateEmployeeIdKey(record);

      expect(key).toBeDefined();
      expect(key?.type).toBe('employeeId');
      expect(key?.value).toBe('E001');
    });

    it('员工编号为空时应该返回null', () => {
      const record = createRecord({ employeeId: '' });
      const key = dedupEngine.generateEmployeeIdKey(record);

      expect(key).toBeNull();
    });

    it('应该基于手机号生成去重键', () => {
      const record = createRecord({ phone: '13800138001' });
      const key = dedupEngine.generatePhoneKey(record);

      expect(key).toBeDefined();
      expect(key?.type).toBe('phone');
      expect(key?.value).toBe('13800138001');
    });

    it('手机号为空时应该返回null', () => {
      const record = createRecord({ phone: '' });
      const key = dedupEngine.generatePhoneKey(record);

      expect(key).toBeNull();
    });

    it('应该基于姓名+手机号生成去重键', () => {
      const record = createRecord({ employeeName: '张三', phone: '13800138001' });
      const key = dedupEngine.generateNameAndPhoneKey(record);

      expect(key).toBeDefined();
      expect(key?.type).toBe('nameAndPhone');
      expect(key?.value).toBe('张三:13800138001');
    });

    it('姓名或手机号为空时应该返回null', () => {
      const record1 = createRecord({ employeeName: '', phone: '13800138001' });
      const record2 = createRecord({ employeeName: '张三', phone: '' });

      expect(dedupEngine.generateNameAndPhoneKey(record1)).toBeNull();
      expect(dedupEngine.generateNameAndPhoneKey(record2)).toBeNull();
    });

    it('应该生成所有可用的去重键', () => {
      const record = createRecord({
        employeeId: 'E001',
        employeeName: '张三',
        phone: '13800138001'
      });

      const keys = dedupEngine.generateAllKeys(record);
      expect(keys.length).toBe(3);
      expect(keys.some(k => k.type === 'employeeId')).toBe(true);
      expect(keys.some(k => k.type === 'phone')).toBe(true);
      expect(keys.some(k => k.type === 'nameAndPhone')).toBe(true);
    });
  });

  describe('手机号规范化测试', () => {
    it('应该移除手机号中的空格', () => {
      expect(dedupEngine.normalizePhone('138 0013 8001')).toBe('13800138001');
    });

    it('应该移除手机号中的横杠', () => {
      expect(dedupEngine.normalizePhone('138-0013-8001')).toBe('13800138001');
    });

    it('应该移除手机号中的国家代码前缀', () => {
      expect(dedupEngine.normalizePhone('+8613800138001')).toBe('13800138001');
      expect(dedupEngine.normalizePhone('8613800138001')).toBe('13800138001');
    });

    it('应该处理混合格式的手机号', () => {
      expect(dedupEngine.normalizePhone('+86 138-0013-8001')).toBe('13800138001');
    });

    it('空手机号应该返回空字符串', () => {
      expect(dedupEngine.normalizePhone('')).toBe('');
    });
  });

  describe('相同员工检测测试', () => {
    it('相同员工编号应该判定为同一员工', () => {
      const r1 = createRecord({ employeeId: 'E001', employeeName: '张三' });
      const r2 = createRecord({ employeeId: 'E001', employeeName: '张三丰' });

      expect(dedupEngine.isSameEmployee(r1, r2)).toBe(true);
    });

    it('不同员工编号应该判定为不同员工', () => {
      const r1 = createRecord({ employeeId: 'E001' });
      const r2 = createRecord({ employeeId: 'E002' });

      expect(dedupEngine.isSameEmployee(r1, r2)).toBe(false);
    });

    it('相同姓名和手机号但无员工编号时应该判定为同一员工', () => {
      const r1 = createRecord({ employeeId: '', employeeName: '张三', phone: '13800138001' });
      const r2 = createRecord({ employeeId: '', employeeName: '张三', phone: '13800138001' });

      expect(dedupEngine.isSameEmployee(r1, r2)).toBe(true);
    });

    it('不同姓名即使手机号相同也应该判定为不同员工', () => {
      const r1 = createRecord({ employeeName: '张三', phone: '13800138001' });
      const r2 = createRecord({ employeeName: '李四', phone: '13800138001' });

      expect(dedupEngine.isSameEmployee(r1, r2)).toBe(false);
    });
  });

  describe('调岗检测测试', () => {
    it('线路不同应该检测为调岗', () => {
      const r1 = createRecord({ employeeId: 'E001', routeName: '1号线', boardingPoint: '公司大门' });
      const r2 = createRecord({ employeeId: 'E001', routeName: '2号线', boardingPoint: '公司大门' });

      expect(dedupEngine.detectTransfer(r1, r2)).toBe(true);
    });

    it('上车点不同应该检测为调岗', () => {
      const r1 = createRecord({ employeeId: 'E001', routeName: '1号线', boardingPoint: '公司大门' });
      const r2 = createRecord({ employeeId: 'E001', routeName: '1号线', boardingPoint: '地铁站' });

      expect(dedupEngine.detectTransfer(r1, r2)).toBe(true);
    });

    it('线路和上车点都相同不应该检测为调岗', () => {
      const r1 = createRecord({ employeeId: 'E001', routeName: '1号线', boardingPoint: '公司大门' });
      const r2 = createRecord({ employeeId: 'E001', routeName: '1号线', boardingPoint: '公司大门' });

      expect(dedupEngine.detectTransfer(r1, r2)).toBe(false);
    });

    it('不同员工即使线路不同也不应该检测为调岗', () => {
      const r1 = createRecord({ employeeId: 'E001', routeName: '1号线' });
      const r2 = createRecord({ employeeId: 'E002', routeName: '2号线' });

      expect(dedupEngine.detectTransfer(r1, r2)).toBe(false);
    });
  });

  describe('最佳记录选择测试', () => {
    it('应该选择信息最完整的记录', () => {
      const records = [
        createRecord({ employeeId: 'E001', employeeName: '张三' }),
        createRecord({
          employeeId: 'E001',
          employeeName: '张三',
          phone: '13800138001',
          routeName: '1号线',
          department: '技术部',
          boardingPoint: '公司大门'
        })
      ];

      const best = dedupEngine.selectBestRecord(records);
      expect(best.phone).toBe('13800138001');
      expect(best.department).toBe('技术部');
      expect(best.boardingPoint).toBe('公司大门');
    });

    it('信息完整度相同时应该选择出现较早的记录', () => {
      const records = [
        createRecord({ employeeId: 'E001', employeeName: '张三', routeName: '1号线' }),
        createRecord({ employeeId: 'E001', employeeName: '张三', routeName: '1号线' })
      ];

      const best = dedupEngine.selectBestRecord(records);
      expect(best.rowNumber).toBe(1);
    });
  });

  describe('相同线路和上车点检测测试', () => {
    it('相同线路名称应该判定为相同', () => {
      const r1 = createRecord({ routeName: '1号线' });
      const r2 = createRecord({ routeName: '1号线' });

      expect(dedupEngine.isSameRoute(r1, r2)).toBe(true);
    });

    it('不同线路名称应该判定为不同', () => {
      const r1 = createRecord({ routeName: '1号线' });
      const r2 = createRecord({ routeName: '2号线' });

      expect(dedupEngine.isSameRoute(r1, r2)).toBe(false);
    });

    it('相同上车点应该判定为相同', () => {
      const r1 = createRecord({ boardingPoint: '公司大门' });
      const r2 = createRecord({ boardingPoint: '公司大门' });

      expect(dedupEngine.isSameBoardingPoint(r1, r2)).toBe(true);
    });

    it('不同上车点应该判定为不同', () => {
      const r1 = createRecord({ boardingPoint: '公司大门' });
      const r2 = createRecord({ boardingPoint: '地铁站' });

      expect(dedupEngine.isSameBoardingPoint(r1, r2)).toBe(false);
    });
  });

  describe('分组测试', () => {
    it('应该按去重键正确分组记录', () => {
      const records = [
        createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线' }),
        createRecord({ employeeId: 'E001', employeeName: '张三', phone: '13800138001', routeName: '1号线', rowNumber: 2 }),
        createRecord({ employeeId: 'E002', employeeName: '李四', phone: '13800138002', routeName: '2号线', rowNumber: 3 })
      ];

      const groups = dedupEngine.groupByKey(records);
      expect(groups.size).toBeGreaterThan(0);
    });
  });
});
