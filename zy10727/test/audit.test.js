const path = require('path');
const { runAudit, parseCSV, generateRecordKey, normalizeRecord, RECORD_TYPES } = require('../src/index');

describe('门禁离线日志补开记录稽核 - 核心功能测试', () => {
  
  test('CSV文件解析功能正常', async () => {
    const normalPath = path.join(__dirname, '../samples/scenario-perfect-match/normal-log.csv');
    const records = await parseCSV(normalPath);
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBe(3);
    expect(records[0].卡号).toBe('2001');
    expect(records[0].姓名).toBe('测试用户A');
  });

  test('记录键值生成正确', () => {
    const record = {
      通行时间: '2026-05-10 08:30:00',
      卡号: '1001',
      设备编号: 'DEV001',
      通行方向: '进'
    };
    const key = generateRecordKey(record);
    expect(key).toBe('2026-05-10 08:30:00|1001|DEV001|进');
  });

  test('记录标准化处理兼容不同字段名', () => {
    const normalRecord = {
      通行时间: '2026-05-10 08:30:00',
      卡号: '1001',
      姓名: '张三',
      设备编号: 'DEV001'
    };
    const normalized1 = normalizeRecord(normalRecord, '正常');
    expect(normalized1.卡号).toBe('1001');
    expect(normalized1.姓名).toBe('张三');
    expect(normalized1.来源).toBe('正常');

    const offlineRecord = {
      补开时间: '2026-05-10 08:30:00',
      员工卡号: '1001',
      员工姓名: '张三',
      门禁设备: 'DEV001'
    };
    const normalized2 = normalizeRecord(offlineRecord, '补开');
    expect(normalized2.卡号).toBe('1001');
    expect(normalized2.姓名).toBe('张三');
  });

});

describe('门禁离线日志补开记录稽核 - 场景测试', () => {

  test('场景1: 完美匹配 - 所有记录匹配成功', async () => {
    const normalPath = path.join(__dirname, '../samples/scenario-perfect-match/normal-log.csv');
    const offlinePath = path.join(__dirname, '../samples/scenario-perfect-match/offline-log.csv');
    
    const result = await runAudit({
      normalLogPath: normalPath,
      offlineLogPath: offlinePath
    });

    expect(result.统计信息.正常日志总数).toBe(3);
    expect(result.统计信息.补开日志总数).toBe(3);
    expect(result.统计信息.匹配成功).toBe(3);
    expect(result.统计信息.重复记录).toBe(0);
    expect(result.统计信息.缺失记录).toBe(0);
    expect(result.摘要).toContainEqual(expect.stringContaining('稽核通过'));
  });

  test('场景2: 包含重复记录 - 正确识别重复', async () => {
    const normalPath = path.join(__dirname, '../samples/scenario-with-duplicates/normal-log.csv');
    const offlinePath = path.join(__dirname, '../samples/scenario-with-duplicates/offline-log.csv');
    
    const result = await runAudit({
      normalLogPath: normalPath,
      offlineLogPath: offlinePath
    });

    expect(result.统计信息.正常日志总数).toBe(2);
    expect(result.统计信息.补开日志总数).toBe(3);
    expect(result.统计信息.匹配成功).toBe(2);
    expect(result.统计信息.重复记录).toBe(1);
    
    const duplicateRecords = result.异常记录.filter(r => r.异常类型 === RECORD_TYPES.DUPLICATE);
    expect(duplicateRecords.length).toBe(1);
    expect(duplicateRecords[0].记录信息.卡号).toBe('3001');
    expect(result.摘要).toContainEqual(expect.stringContaining('稽核不通过'));
  });

  test('场景3: 包含缺失记录 - 正确识别正常日志中缺失的记录', async () => {
    const normalPath = path.join(__dirname, '../samples/scenario-with-missing/normal-log.csv');
    const offlinePath = path.join(__dirname, '../samples/scenario-with-missing/offline-log.csv');
    
    const result = await runAudit({
      normalLogPath: normalPath,
      offlineLogPath: offlinePath
    });

    expect(result.统计信息.正常日志总数).toBe(3);
    expect(result.统计信息.补开日志总数).toBe(2);
    expect(result.统计信息.匹配成功).toBe(2);
    expect(result.统计信息.缺失记录).toBe(1);
    
    const missingRecords = result.异常记录.filter(r => r.异常类型 === RECORD_TYPES.MISSING);
    expect(missingRecords.length).toBe(1);
    expect(missingRecords[0].记录信息.卡号).toBe('4003');
    expect(result.摘要).toContainEqual(expect.stringContaining('稽核不通过'));
  });

  test('场景4: 特殊类型识别 - 离线重连、临时访客、设备换号', async () => {
    const normalPath = path.join(__dirname, '../samples/scenario-special-types/normal-log.csv');
    const offlinePath = path.join(__dirname, '../samples/scenario-special-types/offline-log.csv');
    
    const result = await runAudit({
      normalLogPath: normalPath,
      offlineLogPath: offlinePath
    });

    expect(result.统计信息.正常日志总数).toBe(4);
    expect(result.统计信息.补开日志总数).toBe(4);
    expect(result.统计信息.匹配成功).toBe(4);
    expect(result.统计信息.离线重连).toBe(2);
    expect(result.统计信息.临时访客).toBe(1);
    expect(result.统计信息.设备换号).toBe(2);
    
    expect(result.摘要).toContainEqual(expect.stringContaining('离线重连记录: 2'));
    expect(result.摘要).toContainEqual(expect.stringContaining('临时访客记录: 1'));
    expect(result.摘要).toContainEqual(expect.stringContaining('设备换号记录: 2'));
  });

  test('场景5: 综合场景 - 主样例文件完整稽核', async () => {
    const normalPath = path.join(__dirname, '../samples/normal-pass-log.csv');
    const offlinePath = path.join(__dirname, '../samples/offline-makeup-log.csv');
    
    const result = await runAudit({
      normalLogPath: normalPath,
      offlineLogPath: offlinePath
    });

    expect(result.统计信息.正常日志总数).toBe(10);
    expect(result.统计信息.补开日志总数).toBe(9);
    expect(result.统计信息.匹配成功).toBeGreaterThan(0);
    expect(result.统计信息.重复记录).toBe(1);
    expect(result.统计信息.缺失记录).toBeGreaterThan(0);
    expect(result.统计信息.离线重连).toBe(2);
    expect(result.统计信息.临时访客).toBe(1);
    expect(result.统计信息.设备换号).toBe(1);

    expect(result.稽核详情.length).toBeGreaterThan(0);
    expect(result.摘要.length).toBeGreaterThan(0);
    expect(result.摘要[0]).toBe('【门禁离线日志补开记录稽核摘要】');
  });

});

describe('门禁离线日志补开记录稽核 - 边界条件测试', () => {

  test('空文件路径抛出错误', async () => {
    await expect(runAudit({
      normalLogPath: '',
      offlineLogPath: ''
    })).rejects.toThrow();
  });

  test('不存在的文件路径抛出错误', async () => {
    await expect(runAudit({
      normalLogPath: 'nonexistent.csv',
      offlineLogPath: 'nonexistent2.csv'
    })).rejects.toThrow();
  });

});
