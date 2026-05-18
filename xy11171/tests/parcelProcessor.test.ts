import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import { ParcelProcessor } from '../src/parcelProcessor';

describe('ParcelProcessor', () => {
  let processor: ParcelProcessor;
  let testDir: string;

  beforeEach(() => {
    processor = new ParcelProcessor();
    testDir = path.join(__dirname, 'test_data');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('正常文件处理', () => {
    it('应该正确处理正常的包裹数据文件', async () => {
      const filePath = path.join(testDir, 'normal.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
YT9876543210987,李四,13900139001,2024-01-15 10:15:00,李四,本人,已签收,B区-02柜,圆通,
`);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(0);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('缺列测试', () => {
    it('应该检测到缺少必要列的情况', async () => {
      const filePath = path.join(testDir, 'missing_column.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,status,location
SF1234567890123,张三,13800138001,已签收,A区-01柜
`);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_column')).toBe(true);
    });
  });

  describe('重复行测试', () => {
    it('应该检测到重复的快递单号', async () => {
      const filePath = path.join(testDir, 'duplicate.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
YT9876543210987,李四,13900139001,2024-01-15 10:15:00,李四,本人,已签收,B区-02柜,圆通,
`);

      const result = await processor.processFile(filePath);
      expect(result.totalRecords).toBe(3);
      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(1);
      expect(result.errors.some(e => e.type === 'duplicate')).toBe(true);
    });
  });

  describe('空文件测试', () => {
    it('应该正确处理完全空的文件', async () => {
      const filePath = path.join(testDir, 'empty.csv');
      fs.writeFileSync(filePath, '');

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.type === 'empty_file')).toBe(true);
    });

    it('应该正确处理只有表头没有数据的文件', async () => {
      const filePath = path.join(testDir, 'only_header.csv');
      fs.writeFileSync(filePath, 'trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes\n');

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(0);
    });
  });

  describe('编码异常测试', () => {
    it('应该能够处理UTF-8编码的文件', async () => {
      const filePath = path.join(testDir, 'utf8.csv');
      const content = `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
`;
      fs.writeFileSync(filePath, Buffer.from(content, 'utf8'));

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
    });

    it('应该能够处理GBK编码的文件', async () => {
      const filePath = path.join(testDir, 'gbk.csv');
      const content = `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
`;
      const gbkBuffer = iconv.encode(content, 'gbk');
      fs.writeFileSync(filePath, gbkBuffer);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
    });
  });

  describe('异常检测测试', () => {
    it('应该检测到家人代取的情况', async () => {
      const filePath = path.join(testDir, 'family_pickup.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1112223334445,周八,15800158001,2024-01-16 08:30:00,周八爸爸,家人代取,已签收,A区-12柜,顺丰,家属代取
`);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.anomalies.some(a => a.type === 'family_pickup')).toBe(true);
    });

    it('应该检测到面单遮挡的情况', async () => {
      const filePath = path.join(testDir, 'label_obscured.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
ZT9990001112223,郑十,15700157001,2024-01-16 10:20:00,郑十,本人,已签收,C区-20柜,中通,面单有部分遮挡
`);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.anomalies.some(a => a.type === 'label_obscured')).toBe(true);
    });

    it('应该检测到可复跑的情况', async () => {
      const filePath = path.join(testDir, 'rerun.csv');
      fs.writeFileSync(filePath, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF7778889990001,褚十三,15400154001,,褚十三,,待处理,C区-35柜,顺丰,等待取件
`);

      const result = await processor.processFile(filePath);
      expect(result.success).toBe(true);
      expect(result.anomalies.some(a => a.type === 'rerun_required')).toBe(true);
    });
  });

  describe('汇总报告测试', () => {
    it('应该正确生成汇总报告', async () => {
      const filePath1 = path.join(testDir, 'file1.csv');
      const filePath2 = path.join(testDir, 'file2.csv');
      const filePath3 = path.join(testDir, 'file3.csv');
      
      fs.writeFileSync(filePath1, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三爸爸,家人代取,已签收,A区-01柜,顺丰,家属代取
`);
      
      fs.writeFileSync(filePath2, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
YT9876543210987,李四,13900139001,2024-01-15 10:15:00,李四,本人,已签收,B区-02柜,圆通,面单模糊
`);

      fs.writeFileSync(filePath3, 'trackingNumber,recipient,phone\nSF123,张三,13800138001\n');

      const result1 = await processor.processFile(filePath1);
      const result2 = await processor.processFile(filePath2);
      const result3 = await processor.processFile(filePath3);

      const report = processor.generateSummaryReport([result1, result2, result3]);

      expect(report).toContain('快递驿站包裹找回');
      expect(report).toContain('总文件数:     3');
      expect(report).toContain('处理失败:     1 个文件');
      expect(report).toContain('家人代取');
      expect(report).toContain('面单遮挡');
      expect(report).toContain('追责与复盘建议');
    });
  });

  describe('部分失败后继续处理', () => {
    it('应该在一个文件失败后继续处理其他文件', async () => {
      const filePath1 = path.join(testDir, 'bad.csv');
      const filePath2 = path.join(testDir, 'good.csv');
      
      fs.writeFileSync(filePath1, 'bad content');
      
      fs.writeFileSync(filePath2, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
`);

      const result1 = await processor.processFile(filePath1);
      const result2 = await processor.processFile(filePath2);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
      expect(result2.totalRecords).toBe(1);
    });

    it('应该在汇总报告中显示未处理的文件', async () => {
      const filePath1 = path.join(testDir, 'failed.csv');
      const filePath2 = path.join(testDir, 'success.csv');
      
      fs.writeFileSync(filePath1, '');
      
      fs.writeFileSync(filePath2, `trackingNumber,recipient,phone,pickupTime,pickupPerson,pickupMethod,status,location,courier,notes
SF1234567890123,张三,13800138001,2024-01-15 09:30:00,张三,本人,已签收,A区-01柜,顺丰,
`);

      const result1 = await processor.processFile(filePath1);
      const result2 = await processor.processFile(filePath2);

      const report = processor.generateSummaryReport([result1, result2]);

      expect(report).toContain('未处理文件');
      expect(report).toContain('failed.csv');
    });
  });
});
