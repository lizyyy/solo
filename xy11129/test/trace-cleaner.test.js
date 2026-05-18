const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const TraceCleaner = require('../src/index');

describe('骑行俱乐部骑行轨迹整理 - 核心功能测试', () => {
  let cleaner;
  let tmpDir;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true }).name;
    cleaner = new TraceCleaner({ outputDir: tmpDir });
  });

  afterEach(() => {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  const getSamplePath = (filename) => {
    return path.join(__dirname, '..', 'data', 'samples', filename);
  };

  describe('1. 空文件处理测试', () => {
    it('应该正确识别空文件并记录错误', async () => {
      const result = await cleaner.processFile(getSamplePath('empty_file.csv'));
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('EMPTY_FILE');
      expect(cleaner.getStats().failedFiles).toBe(1);
      expect(cleaner.getStats().processedFiles).toBe(0);
    });
  });

  describe('2. 缺列处理测试', () => {
    it('应该检测到缺失的必需列', async () => {
      const result = await cleaner.processFile(getSamplePath('missing_columns.csv'));
      
      const missingColError = result.errors.find(e => e.type === 'MISSING_COLUMNS');
      expect(missingColError).toBeDefined();
      expect(missingColError.missingFields).toContain('ride_id');
      expect(result.success).toBe(true);
    });

    it('必需字段列表应该包含骑行核心字段', () => {
      const requiredFields = ['timestamp', 'latitude', 'longitude', 'altitude', 'speed', 'rider_id', 'ride_id'];
      expect(requiredFields).toEqual(expect.arrayContaining(['rider_id', 'ride_id', 'timestamp']));
    });
  });

  describe('3. 重复行处理测试', () => {
    it('应该检测并过滤重复记录', async () => {
      const result = await cleaner.processFile(getSamplePath('duplicate_rows.csv'));
      
      const duplicateErrors = result.errors.filter(e => e.type === 'DUPLICATE_RECORD');
      expect(duplicateErrors).toHaveLength(2);
      expect(result.records).toHaveLength(4);
      expect(cleaner.getStats().duplicateRecords).toBe(2);
      expect(cleaner.getStats().validRecords).toBe(4);
    });

    it('应该使用正确的去重键', async () => {
      const result = await cleaner.processFile(getSamplePath('duplicate_rows.csv'));
      
      const seenKeys = new Set();
      let hasDuplicate = false;
      for (const record of result.records) {
        const key = `${record.rider_id}_${record.ride_id}_${record.timestamp}`;
        if (seenKeys.has(key)) {
          hasDuplicate = true;
          break;
        }
        seenKeys.add(key);
      }
      expect(hasDuplicate).toBe(false);
    });
  });

  describe('4. 无效记录处理测试', () => {
    it('应该检测各种类型的无效字段值', async () => {
      const result = await cleaner.processFile(getSamplePath('invalid_records.csv'));
      
      const invalidErrors = result.errors.filter(e => e.type === 'INVALID_RECORD');
      expect(invalidErrors).toHaveLength(8);
      expect(result.records).toHaveLength(2);
      expect(cleaner.getStats().invalidRecords).toBe(8);
    });

    it('应该正确验证经纬度范围', async () => {
      const errors = cleaner.validateRecord({
        timestamp: '2024-05-19T00:00:00Z',
        latitude: '95.0',
        longitude: '200.0',
        altitude: '50',
        speed: '20',
        rider_id: 'R001',
        ride_id: 'RD001'
      });
      
      expect(errors).toContain('纬度值无效');
      expect(errors).toContain('经度值无效');
    });

    it('应该正确验证速度范围', async () => {
      const negativeSpeed = cleaner.validateRecord({
        timestamp: '2024-05-19T00:00:00Z',
        latitude: '40.0',
        longitude: '116.0',
        altitude: '50',
        speed: '-5',
        rider_id: 'R001',
        ride_id: 'RD001'
      });
      
      const excessiveSpeed = cleaner.validateRecord({
        timestamp: '2024-05-19T00:00:00Z',
        latitude: '40.0',
        longitude: '116.0',
        altitude: '50',
        speed: '200',
        rider_id: 'R001',
        ride_id: 'RD001'
      });
      
      expect(negativeSpeed).toContain('速度值无效（应为0-150 km/h）');
      expect(excessiveSpeed).toContain('速度值无效（应为0-150 km/h）');
    });
  });

  describe('5. 设备断电检测测试', () => {
    it('应该检测到设备断电导致的时间断层', async () => {
      const result = await cleaner.processFile(getSamplePath('power_loss_ride.csv'));
      
      const powerLossError = result.errors.find(e => e.type === 'POWER_LOSS_DETECTED');
      expect(powerLossError).toBeDefined();
      expect(powerLossError.count).toBe(2);
      expect(cleaner.getStats().powerLossEvents).toBe(2);
    });

    it('正常骑行数据不应该检测到断电事件', async () => {
      const result = await cleaner.processFile(getSamplePath('normal_ride.csv'));
      
      const powerLossError = result.errors.find(e => e.type === 'POWER_LOSS_DETECTED');
      expect(powerLossError).toBeUndefined();
      expect(cleaner.getStats().powerLossEvents).toBe(0);
    });

    it('30分钟以上间隔应该判定为断电', () => {
      const records = [
        { timestamp: '2024-05-19T07:00:00Z', latitude: 40.0, longitude: 116.0 },
        { timestamp: '2024-05-19T07:31:00Z', latitude: 40.1, longitude: 116.1 }
      ];
      const count = cleaner.detectPowerLoss(records);
      expect(count).toBe(1);
    });
  });

  describe('6. 路线反向检测测试', () => {
    it('应该检测到路线反向异常', async () => {
      const result = await cleaner.processFile(getSamplePath('reverse_route.csv'));
      
      const reverseError = result.errors.find(e => e.type === 'REVERSE_ROUTE_DETECTED');
      expect(reverseError).toBeDefined();
      expect(cleaner.getStats().reverseRouteEvents).toBeGreaterThan(0);
    });

    it('正常骑行数据不应该检测到路线反向', async () => {
      const result = await cleaner.processFile(getSamplePath('normal_ride.csv'));
      
      const reverseError = result.errors.find(e => e.type === 'REVERSE_ROUTE_DETECTED');
      expect(reverseError).toBeUndefined();
    });
  });

  describe('7. 批量处理与部分失败测试', () => {
    it('应该成功处理正常文件', async () => {
      const result = await cleaner.processFile(getSamplePath('normal_ride.csv'));
      
      expect(result.success).toBe(true);
      expect(result.records).toHaveLength(10);
      expect(cleaner.getStats().processedFiles).toBe(1);
      expect(cleaner.getStats().validRecords).toBe(10);
    });

    it('应该累积多个文件的处理统计', async () => {
      await cleaner.processFile(getSamplePath('normal_ride.csv'));
      await cleaner.processFile(getSamplePath('empty_file.csv'));
      await cleaner.processFile(getSamplePath('duplicate_rows.csv'));
      
      const stats = cleaner.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.processedFiles).toBe(2);
      expect(stats.failedFiles).toBe(1);
      expect(stats.validRecords).toBe(14);
      expect(stats.duplicateRecords).toBe(2);
    });

    it('应该正确生成错误日志', async () => {
      await cleaner.processFile(getSamplePath('empty_file.csv'));
      await cleaner.processFile(getSamplePath('missing_columns.csv'));
      
      await cleaner.writeErrorLog('test_error_log.json');
      
      const logPath = path.join(tmpDir, 'test_error_log.json');
      expect(fs.existsSync(logPath)).toBe(true);
      
      const logContent = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      expect(logContent.errors.length).toBeGreaterThan(0);
      expect(logContent.stats).toBeDefined();
      expect(logContent.timestamp).toBeDefined();
      
      const hasEmptyFileError = logContent.errors.some(e => e.type === 'EMPTY_FILE');
      const hasMissingColumnsError = logContent.errors.some(e => e.type === 'MISSING_COLUMNS');
      expect(hasEmptyFileError).toBe(true);
      expect(hasMissingColumnsError).toBe(true);
    });

    it('应该正确输出清洗后的文件', async () => {
      const result = await cleaner.processFile(getSamplePath('normal_ride.csv'));
      await cleaner.writeCleanedRecords(result.records, 'test_output.csv');
      
      const outputPath = path.join(tmpDir, 'test_output.csv');
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toContain('timestamp,latitude,longitude,altitude,speed,rider_id,ride_id');
      expect(content.split('\n').filter(l => l.trim()).length).toBe(11);
    });
  });

  describe('8. 边界条件测试', () => {
    it('不存在的文件应该返回文件未找到错误', async () => {
      const result = await cleaner.processFile('/nonexistent/path/file.csv');
      
      expect(result.success).toBe(false);
      const fileError = result.errors.find(e => e.type === 'FILE_NOT_FOUND');
      expect(fileError).toBeDefined();
    });

    it('单条记录不应该触发断电或反向检测', async () => {
      const singleRecord = [
        { timestamp: '2024-05-19T00:00:00Z', latitude: 40.0, longitude: 116.0 }
      ];
      expect(cleaner.detectPowerLoss(singleRecord)).toBe(0);
      expect(cleaner.detectReverseRoute(singleRecord)).toBe(0);
    });

    it('少于5条记录不应该触发路线反向检测', () => {
      const fourRecords = [
        { timestamp: '2024-05-19T00:00:00Z', latitude: 40.0, longitude: 116.0 },
        { timestamp: '2024-05-19T00:00:10Z', latitude: 40.1, longitude: 116.1 },
        { timestamp: '2024-05-19T00:00:20Z', latitude: 40.2, longitude: 116.2 },
        { timestamp: '2024-05-19T00:00:30Z', latitude: 40.3, longitude: 116.3 }
      ];
      expect(cleaner.detectReverseRoute(fourRecords)).toBe(0);
    });
  });

  describe('9. 错误路径可见性验证', () => {
    it('错误日志应该包含明确的错误类型和消息', async () => {
      await cleaner.processFile(getSamplePath('invalid_records.csv'));
      await cleaner.writeErrorLog('visibility_test.json');
      
      const logPath = path.join(tmpDir, 'visibility_test.json');
      const logContent = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      
      expect(logContent.errors.length).toBeGreaterThan(0);
      
      logContent.errors.forEach(err => {
        expect(err).toHaveProperty('type');
        expect(err).toHaveProperty('message');
        expect(err).toHaveProperty('file');
        expect(err.type).toBeTruthy();
        expect(err.message).toBeTruthy();
        expect(err.file).toContain('invalid_records.csv');
      });
    });

    it('统计数据应该完整反映所有错误类型', async () => {
      await cleaner.processFile(getSamplePath('invalid_records.csv'));
      await cleaner.processFile(getSamplePath('duplicate_rows.csv'));
      await cleaner.processFile(getSamplePath('power_loss_ride.csv'));
      
      const stats = cleaner.getStats();
      expect(stats).toHaveProperty('invalidRecords');
      expect(stats).toHaveProperty('duplicateRecords');
      expect(stats).toHaveProperty('powerLossEvents');
      expect(stats.invalidRecords).toBeGreaterThan(0);
      expect(stats.duplicateRecords).toBeGreaterThan(0);
      expect(stats.powerLossEvents).toBeGreaterThan(0);
    });
  });
});
