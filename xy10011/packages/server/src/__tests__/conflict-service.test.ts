import { v4 as uuidv4 } from 'uuid';
import { conflictService } from '../services/conflict-service';
import { initDatabase } from '../database';
import { Event } from '../types';

let testUserId: string;
let testClientId: string;

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  initDatabase();
  testUserId = uuidv4();
  testClientId = uuidv4();
});

describe('Conflict Service', () => {
  test('should detect version mismatch conflict', () => {
    const aggregateId = uuidv4();
    
    const existingEvent: Event = {
      id: uuidv4(),
      eventType: 'BILL_CREATED',
      aggregateId,
      aggregateType: 'bill',
      payload: {},
      previousVersion: 0,
      newVersion: 1,
      userId: testUserId,
      timestamp: Date.now(),
      clientId: testClientId,
      sequence: 1,
    };

    const incomingEvent: Event = {
      id: uuidv4(),
      eventType: 'BILL_UPDATED',
      aggregateId,
      aggregateType: 'bill',
      payload: {},
      previousVersion: 0,
      newVersion: 1,
      userId: testUserId,
      timestamp: Date.now() + 1000,
      clientId: testClientId,
      sequence: 2,
    };

    const conflict = conflictService.detectVersionConflict(
      aggregateId,
      incomingEvent,
      [existingEvent]
    );

    expect(conflict).toBeDefined();
    expect(conflict?.type).toBe('version-mismatch');
  });

  test('should detect concurrent edit conflict', () => {
    const aggregateId = uuidv4();
    const anotherUserId = uuidv4();
    
    const existingEvent: Event = {
      id: uuidv4(),
      eventType: 'BILL_UPDATED',
      aggregateId,
      aggregateType: 'bill',
      payload: {},
      previousVersion: 0,
      newVersion: 1,
      userId: anotherUserId,
      timestamp: Date.now() - 1000,
      clientId: testClientId,
      sequence: 1,
    };

    const incomingEvent: Event = {
      id: uuidv4(),
      eventType: 'BILL_UPDATED',
      aggregateId,
      aggregateType: 'bill',
      payload: {},
      previousVersion: 1,
      newVersion: 2,
      userId: testUserId,
      timestamp: Date.now(),
      clientId: testClientId,
      sequence: 2,
    };

    const conflict = conflictService.detectConcurrentEdit(
      aggregateId,
      incomingEvent,
      [existingEvent]
    );

    expect(conflict).toBeDefined();
    expect(conflict?.type).toBe('concurrent-edit');
  });

  test('should detect data inconsistency', () => {
    const aggregateId = uuidv4();
    
    const events: Event[] = [
      {
        id: uuidv4(),
        eventType: 'BILL_CREATED',
        aggregateId,
        aggregateType: 'bill',
        payload: {},
        previousVersion: 0,
        newVersion: 1,
        userId: testUserId,
        timestamp: Date.now() - 2000,
        clientId: testClientId,
        sequence: 1,
      },
      {
        id: uuidv4(),
        eventType: 'BILL_UPDATED',
        aggregateId,
        aggregateType: 'bill',
        payload: {},
        previousVersion: 1,
        newVersion: 2,
        userId: testUserId,
        timestamp: Date.now() - 1000,
        clientId: testClientId,
        sequence: 2,
      },
      {
        id: uuidv4(),
        eventType: 'BILL_UPDATED',
        aggregateId,
        aggregateType: 'bill',
        payload: {},
        previousVersion: 1,
        newVersion: 3,
        userId: testUserId,
        timestamp: Date.now(),
        clientId: testClientId,
        sequence: 3,
      },
    ];

    const conflict = conflictService.detectDataInconsistency(aggregateId, events);

    expect(conflict).toBeDefined();
    expect(conflict?.type).toBe('data-inconsistency');
  });

  test('should merge events correctly', async () => {
    const aggregateId = uuidv4();
    
    const events: Event[] = [
      {
        id: uuidv4(),
        eventType: 'BILL_CREATED',
        aggregateId,
        aggregateType: 'bill',
        payload: { bill: { title: '原始标题', amount: 100 } },
        previousVersion: 0,
        newVersion: 1,
        userId: testUserId,
        timestamp: Date.now() - 2000,
        clientId: testClientId,
        sequence: 1,
      },
      {
        id: uuidv4(),
        eventType: 'BILL_UPDATED',
        aggregateId,
        aggregateType: 'bill',
        payload: { updates: { title: '新标题' } },
        previousVersion: 1,
        newVersion: 2,
        userId: testUserId,
        timestamp: Date.now() - 1000,
        clientId: testClientId,
        sequence: 2,
      },
      {
        id: uuidv4(),
        eventType: 'BILL_UPDATED',
        aggregateId,
        aggregateType: 'bill',
        payload: { updates: { amount: 200 } },
        previousVersion: 2,
        newVersion: 3,
        userId: testUserId,
        timestamp: Date.now(),
        clientId: testClientId,
        sequence: 3,
      },
    ];

    const merged = await conflictService.mergeEvents(events);

    expect(merged).toBeDefined();
    expect((merged as any).title).toBe('新标题');
    expect((merged as any).amount).toBe(200);
  });

  test('should persist and resolve conflict', async () => {
    const aggregateId = uuidv4();
    const event1 = uuidv4();
    const event2 = uuidv4();

    const conflict: any = {
      id: uuidv4(),
      eventId1: event1,
      eventId2: event2,
      aggregateId,
      type: 'version-mismatch',
      status: 'pending',
      detectedAt: Date.now(),
    };

    await conflictService.persistConflict(conflict);

    const retrieved = conflictService.getConflictById(conflict.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.status).toBe('pending');

    const resolved = await conflictService.resolveConflict(
      conflict.id,
      { strategy: 'last-write-wins' },
      testUserId
    );

    expect(resolved.status).toBe('resolved');
    expect(resolved.resolution?.strategy).toBe('last-write-wins');
    expect(resolved.resolution?.resolvedBy).toBe(testUserId);
  });
});
