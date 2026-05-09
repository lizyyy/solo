import { v4 as uuidv4 } from 'uuid';
import { reportService } from '../services/report-service';
import { billService } from '../services/bill-service';
import { groupService } from '../services/group-service';
import { initDatabase } from '../database';

let testUserId: string;
let testClientId: string;
let testGroup: any;

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  initDatabase();
  testUserId = uuidv4();
  testClientId = uuidv4();
});

beforeEach(async () => {
  testGroup = await groupService.createGroup(
    {
      name: '测试群组',
      members: [testUserId],
      createdBy: testUserId,
    },
    testUserId,
    testClientId
  );

  await billService.createBill(
    {
      groupId: testGroup.id,
      title: '测试账单1',
      amount: 100,
      currency: 'CNY',
      createdBy: testUserId,
      participants: [{ userId: testUserId, share: 100, paid: 100 }],
    },
    testUserId,
    testClientId
  );

  await billService.createBill(
    {
      groupId: testGroup.id,
      title: '测试账单2',
      amount: 200,
      currency: 'CNY',
      createdBy: testUserId,
      participants: [{ userId: testUserId, share: 200, paid: 200 }],
    },
    testUserId,
    testClientId
  );
});

describe('Report Service', () => {
  test('should generate markdown report', async () => {
    const buffer = await reportService.generateReport({
      format: 'markdown',
      groupId: testGroup.id,
      includeDetails: true,
      includeAuditLog: false,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    const content = buffer.toString('utf-8');
    expect(content).toContain('Bill Split Report');
    expect(content).toContain('测试账单1');
    expect(content).toContain('测试账单2');
    expect(content).toContain('300.00');
  });

  test('should generate excel report', async () => {
    const buffer = await reportService.generateReport({
      format: 'excel',
      groupId: testGroup.id,
      includeDetails: true,
      includeAuditLog: false,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4B);
  });

  test('should generate pdf report', async () => {
    const buffer = await reportService.generateReport({
      format: 'pdf',
      groupId: testGroup.id,
      includeDetails: true,
      includeAuditLog: false,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    const header = buffer.slice(0, 4).toString('utf-8');
    expect(header).toBe('%PDF');
  });

  test('should filter by date range', async () => {
    const now = Date.now();
    
    const buffer = await reportService.generateReport({
      format: 'markdown',
      groupId: testGroup.id,
      startDate: now - 3600000,
      endDate: now + 3600000,
      includeDetails: true,
      includeAuditLog: false,
    });

    const content = buffer.toString('utf-8');
    expect(content).toContain('测试账单1');
    expect(content).toContain('测试账单2');
  });

  test('should include audit log when requested', async () => {
    const buffer = await reportService.generateReport({
      format: 'markdown',
      groupId: testGroup.id,
      includeDetails: true,
      includeAuditLog: true,
    });

    const content = buffer.toString('utf-8');
    expect(content).toContain('Audit Log');
  });
});
