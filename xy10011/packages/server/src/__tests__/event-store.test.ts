import { v4 as uuidv4 } from 'uuid';
import { eventStore, VersionConflictError } from '../event-store';
import { initDatabase } from '../database';

let testUserId: string;
let testClientId: string;
let testAggregateId: string;

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  initDatabase();
  testUserId = uuidv4();
  testClientId = uuidv4();
  testAggregateId = uuidv4();
});

describe('Event Store', () => {
  test('should append event successfully', async () => {
    const aggregateId = uuidv4();
    
    const event = await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      { test: 'data' },
      testUserId,
      testClientId,
      0
    );

    expect(event).toBeDefined();
    expect(event.id).toBeTruthy();
    expect(event.previousVersion).toBe(0);
    expect(event.newVersion).toBe(1);
    expect(event.eventType).toBe('BILL_CREATED');
  });

  test('should detect version conflict', async () => {
    const aggregateId = uuidv4();

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      { test: 'data1' },
      testUserId,
      testClientId,
      0
    );

    await expect(
      eventStore.appendEvent(
        aggregateId,
        'bill',
        'BILL_UPDATED',
        { test: 'data2' },
        testUserId,
        testClientId,
        0
      )
    ).rejects.toBeInstanceOf(VersionConflictError);
  });

  test('should increment version correctly', async () => {
    const aggregateId = uuidv4();

    const event1 = await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      { amount: 100 },
      testUserId,
      testClientId,
      0
    );

    const event2 = await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_UPDATED',
      { amount: 200 },
      testUserId,
      testClientId,
      event1.newVersion
    );

    const event3 = await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_UPDATED',
      { amount: 300 },
      testUserId,
      testClientId,
      event2.newVersion
    );

    expect(event1.newVersion).toBe(1);
    expect(event2.newVersion).toBe(2);
    expect(event3.newVersion).toBe(3);
  });

  test('should retrieve events by aggregate', async () => {
    const aggregateId = uuidv4();

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      {},
      testUserId,
      testClientId,
      0
    );

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_UPDATED',
      {},
      testUserId,
      testClientId,
      1
    );

    const events = eventStore.getEventsByAggregate(aggregateId);

    expect(events.length).toBe(2);
    expect(events[0].sequence).toBe(1);
    expect(events[1].sequence).toBe(2);
  });

  test('should retrieve events by user', async () => {
    const userId = uuidv4();
    const aggregateId1 = uuidv4();
    const aggregateId2 = uuidv4();

    await eventStore.appendEvent(
      aggregateId1,
      'bill',
      'BILL_CREATED',
      {},
      userId,
      testClientId,
      0
    );

    await eventStore.appendEvent(
      aggregateId2,
      'bill',
      'BILL_CREATED',
      {},
      userId,
      testClientId,
      0
    );

    const events = eventStore.getEventsByUser(userId, 10);

    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  test('should replay events', async () => {
    const aggregateId = uuidv4();

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      { amount: 100 },
      testUserId,
      testClientId,
      0
    );

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_UPDATED',
      { amount: 200 },
      testUserId,
      testClientId,
      1
    );

    await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_UPDATED',
      { amount: 300 },
      testUserId,
      testClientId,
      2
    );

    const eventsVersion2 = eventStore.replayEvents(aggregateId, 2);

    expect(eventsVersion2.length).toBe(2);
    expect(eventsVersion2[eventsVersion2.length - 1].newVersion).toBe(2);
  });

  test('should include correlation id in events', async () => {
    const aggregateId = uuidv4();
    const correlationId = uuidv4();

    const event = await eventStore.appendEvent(
      aggregateId,
      'bill',
      'BILL_CREATED',
      {},
      testUserId,
      testClientId,
      0,
      { correlationId }
    );

    expect(event.correlationId).toBe(correlationId);

    const retrievedEvents = eventStore.getEventsByAggregate(aggregateId);
    expect(retrievedEvents[0].correlationId).toBe(correlationId);
  });
});
