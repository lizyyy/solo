import { v4 as uuidv4 } from 'uuid';
import { billService } from '../services/bill-service';
import { groupService } from '../services/group-service';
import { initDatabase } from '../database';
import { Bill, Participant } from '../types';

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
      description: '测试用的群组',
      members: [testUserId],
      createdBy: testUserId,
    },
    testUserId,
    testClientId
  );
});

describe('Bill Service', () => {
  test('should create a bill successfully', async () => {
    const participants: Participant[] = [
      { userId: testUserId, share: 100, paid: 100 },
    ];

    const bill = await billService.createBill(
      {
        groupId: testGroup.id,
        title: '测试账单',
        description: '测试描述',
        amount: 100,
        currency: 'CNY',
        createdBy: testUserId,
        participants,
        tags: ['test'],
      },
      testUserId,
      testClientId
    );

    expect(bill).toBeDefined();
    expect(bill.id).toBeTruthy();
    expect(bill.title).toBe('测试账单');
    expect(bill.amount).toBe(100);
    expect(bill.version).toBe(1);
    expect(bill.deleted).toBe(false);
  });

  test('should validate bill amounts before creation', async () => {
    const participants: Participant[] = [
      { userId: testUserId, share: 50, paid: 100 },
    ];

    await expect(
      billService.createBill(
        {
          groupId: testGroup.id,
          title: '无效账单',
          amount: 100,
          currency: 'CNY',
          createdBy: testUserId,
          participants,
        },
        testUserId,
        testClientId
      )
    ).rejects.toThrow('does not match bill amount');
  });

  test('should update a bill successfully', async () => {
    const participants: Participant[] = [
      { userId: testUserId, share: 100, paid: 100 },
    ];

    const bill = await billService.createBill(
      {
        groupId: testGroup.id,
        title: '原始账单',
        amount: 100,
        currency: 'CNY',
        createdBy: testUserId,
        participants,
      },
      testUserId,
      testClientId
    );

    const updatedParticipants: Participant[] = [
      { userId: testUserId, share: 150, paid: 150 },
    ];

    const updatedBill = await billService.updateBill(
      bill.id,
      {
        title: '更新后的账单',
        amount: 150,
        participants: updatedParticipants,
      },
      testUserId,
      testClientId,
      bill.version
    );

    expect(updatedBill.title).toBe('更新后的账单');
    expect(updatedBill.amount).toBe(150);
    expect(updatedBill.version).toBe(2);
  });

  test('should calculate balances correctly', async () => {
    const user1 = uuidv4();
    const user2 = uuidv4();

    await billService.createBill(
      {
        groupId: testGroup.id,
        title: '测试账单1',
        amount: 200,
        currency: 'CNY',
        createdBy: testUserId,
        participants: [
          { userId: user1, share: 100, paid: 200 },
          { userId: user2, share: 100, paid: 0 },
        ],
      },
      testUserId,
      testClientId
    );

    const balances = billService.calculateBalances(testGroup.id);
    
    expect(balances.get(user1)).toBe(100);
    expect(balances.get(user2)).toBe(-100);
  });

  test('should calculate settlement suggestions', () => {
    const balances = new Map<string, number>();
    balances.set('user1', 100);
    balances.set('user2', -50);
    balances.set('user3', -50);

    const suggestions = billService.calculateSettlementSuggestions(balances);
    
    expect(suggestions.length).toBe(2);
    expect(suggestions.some(s => s.from === 'user2' && s.to === 'user1' && s.amount === 50)).toBe(true);
    expect(suggestions.some(s => s.from === 'user3' && s.to === 'user1' && s.amount === 50)).toBe(true);
  });

  test('should support adjusted shares', async () => {
    const user1 = uuidv4();
    const user2 = uuidv4();

    const bill = await billService.createBill(
      {
        groupId: testGroup.id,
        title: '调整分摊账单',
        amount: 200,
        currency: 'CNY',
        createdBy: testUserId,
        participants: [
          { userId: user1, share: 100, paid: 200, adjustedShare: 120 },
          { userId: user2, share: 100, paid: 0, adjustedShare: 80 },
        ],
      },
      testUserId,
      testClientId
    );

    expect(bill).toBeDefined();
    const balances = billService.calculateBalances(testGroup.id);
    
    expect(balances.get(user1)).toBe(80);
    expect(balances.get(user2)).toBe(-80);
  });
});
