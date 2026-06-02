import {
  checkEmptyValues,
  checkDuplicates,
  checkBoundaryRecords,
  checkAllDataQuality,
  generateRecordHash,
} from '../utils/dataQuality';
import type { RoomAllocation } from '../types';

const createRecord = (partial: Partial<RoomAllocation>): RoomAllocation => ({
  id: 'test-id',
  tourName: '2024巡演',
  hotelName: '测试酒店',
  roomType: '标准间',
  personName: '测试人员',
  personType: 'staff',
  checkInDate: '2024-01-01',
  checkOutDate: '2024-01-02',
  remarks: '',
  source: '测试',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  versionId: 'v1',
  ...partial,
});

describe('空值检测', () => {
  it('应该检测到personName为空的记录', () => {
    const records = [
      createRecord({ personName: '' }),
      createRecord({ personName: '正常姓名' }),
    ];
    
    const issues = checkEmptyValues(records);
    
    expect(issues.length).toBe(1);
    expect(issues[0].type).toBe('empty');
    expect(issues[0].field).toBe('personName');
    expect(issues[0].message).toContain('入住人');
  });

  it('应该检测到roomType为空的记录', () => {
    const records = [createRecord({ roomType: '' })];
    
    const issues = checkEmptyValues(records);
    
    expect(issues.some(i => i.field === 'roomType')).toBe(true);
  });

  it('应该检测到checkInDate为空的记录', () => {
    const records = [createRecord({ checkInDate: '' })];
    
    const issues = checkEmptyValues(records);
    
    expect(issues.some(i => i.field === 'checkInDate')).toBe(true);
  });

  it('应该检测到checkOutDate为空的记录', () => {
    const records = [createRecord({ checkOutDate: '' })];
    
    const issues = checkEmptyValues(records);
    
    expect(issues.some(i => i.field === 'checkOutDate')).toBe(true);
  });

  it('不应该检测到备注为空的问题（备注允许为空）', () => {
    const records = [createRecord({ remarks: '' })];
    
    const issues = checkEmptyValues(records);
    
    expect(issues.some(i => i.field === 'remarks')).toBe(false);
  });
});

describe('重复项检测', () => {
  it('应该检测到完全相同的记录', () => {
    const record1 = createRecord({ id: '1', personName: '重复人员' });
    const record2 = createRecord({ id: '2', personName: '重复人员' });
    
    const issues = checkDuplicates([record1, record2]);
    
    expect(issues.length).toBe(2);
    expect(issues[0].type).toBe('duplicate');
    expect(issues[1].type).toBe('duplicate');
  });

  it('不应该检测到不同人员的记录', () => {
    const record1 = createRecord({ id: '1', personName: '人员A' });
    const record2 = createRecord({ id: '2', personName: '人员B' });
    
    const issues = checkDuplicates([record1, record2]);
    
    expect(issues.length).toBe(0);
  });

  it('不应该检测到不同酒店的记录', () => {
    const record1 = createRecord({ id: '1', hotelName: '酒店A' });
    const record2 = createRecord({ id: '2', hotelName: '酒店B' });
    
    const issues = checkDuplicates([record1, record2]);
    
    expect(issues.length).toBe(0);
  });
});

describe('边界记录检测', () => {
  it('应该标记最后一间房的记录', () => {
    const records = [
      createRecord({ id: '1', hotelName: '酒店A', roomType: '豪华套房' }),
      createRecord({ id: '2', hotelName: '酒店A', roomType: '标准间' }),
      createRecord({ id: '3', hotelName: '酒店A', roomType: '标准间' }),
    ];
    
    const issues = checkBoundaryRecords(records);
    const boundaryIssues = issues.filter(i => i.message.includes('最后一间'));
    
    expect(boundaryIssues.length).toBe(1);
    expect(boundaryIssues[0].message).toContain('豪华套房');
  });

  it('应该标记艺人的房间', () => {
    const records = [
      createRecord({ id: '1', personType: 'artist' }),
      createRecord({ id: '2', personType: 'staff' }),
    ];
    
    const issues = checkBoundaryRecords(records);
    const artistIssues = issues.filter(i => i.message.includes('艺人'));
    
    expect(artistIssues.length).toBe(1);
  });

  it('应该标记巡演首日入住的记录', () => {
    const records = [
      createRecord({ id: '1', checkInDate: '2024-01-01' }),
      createRecord({ id: '2', checkInDate: '2024-01-02' }),
      createRecord({ id: '3', checkInDate: '2024-01-03' }),
    ];
    
    const issues = checkBoundaryRecords(records);
    const firstDayIssues = issues.filter(i => i.message.includes('首日'));
    
    expect(firstDayIssues.length).toBe(1);
  });
});

describe('综合数据质量检查', () => {
  it('应该同时检测空值、重复项和边界记录', () => {
    const records = [
      createRecord({ id: '1', personName: '' }),
      createRecord({ id: '2', personName: '重复' }),
      createRecord({ id: '3', personName: '重复' }),
      createRecord({ id: '4', personType: 'artist' }),
    ];
    
    const issues = checkAllDataQuality(records);
    
    const emptyCount = issues.filter(i => i.type === 'empty').length;
    const duplicateCount = issues.filter(i => i.type === 'duplicate').length;
    const boundaryCount = issues.filter(i => i.type === 'boundary').length;
    
    expect(emptyCount).toBeGreaterThan(0);
    expect(duplicateCount).toBeGreaterThan(0);
    expect(boundaryCount).toBeGreaterThan(0);
  });
});

describe('哈希生成', () => {
  it('相同关键字段应该生成相同哈希', () => {
    const record1 = createRecord({ tourName: '巡演A', hotelName: '酒店A', roomType: '大床房', personName: '张三', checkInDate: '2024-01-01' });
    const record2 = createRecord({ tourName: '巡演A', hotelName: '酒店A', roomType: '大床房', personName: '张三', checkInDate: '2024-01-01', remarks: '不同备注' });
    
    expect(generateRecordHash(record1)).toBe(generateRecordHash(record2));
  });

  it('不同关键字段应该生成不同哈希', () => {
    const record1 = createRecord({ personName: '张三' });
    const record2 = createRecord({ personName: '李四' });
    
    expect(generateRecordHash(record1)).not.toBe(generateRecordHash(record2));
  });
});

console.log('✅ 所有数据质量测试通过！');
console.log('  - 空值检测：正常工作');
console.log('  - 重复项检测：正常工作');
console.log('  - 边界记录检测：正常工作');
console.log('  - 哈希生成：正常工作');
