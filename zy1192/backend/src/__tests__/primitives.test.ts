import { MockTime, EventTimeline, MockThreadScheduler } from '../utils/mock-utils';
import { MockMutex, MockRWLock, MockSpinLock } from '../primitives/locks';
import { MockCAS, MockLockFreeQueue, ABASimulator } from '../primitives/cas-queue';
import { SimulationEngine } from '../simulator/simulation-engine';

describe('MockTime', () => {
  let time: MockTime;

  beforeEach(() => {
    time = new MockTime();
  });

  test('should start at 0', () => {
    expect(time.now).toBe(0);
  });

  test('should advance time correctly', () => {
    time.advance(5);
    expect(time.now).toBe(5);
    time.advance(3);
    expect(time.now).toBe(8);
  });

  test('should generate unique event ids', () => {
    const id1 = time.generateEventId();
    const id2 = time.generateEventId();
    expect(id1).not.toBe(id2);
  });

  test('should reset correctly', () => {
    time.advance(10);
    time.generateEventId();
    time.reset();
    expect(time.now).toBe(0);
  });
});

describe('EventTimeline', () => {
  let time: MockTime;
  let timeline: EventTimeline;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
  });

  test('should add events correctly', () => {
    timeline.addEvent('t1', 'Thread 1', 'lock_acquire_success', { lockName: 'mutex-1' }, 0, 'mutex-1');
    
    const events = timeline.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].threadId).toBe('t1');
    expect(events[0].eventType).toBe('lock_acquire_success');
  });

  test('should filter events by thread', () => {
    timeline.addEvent('t1', 'Thread 1', 'lock_acquire_success', {}, 0);
    timeline.addEvent('t2', 'Thread 2', 'lock_acquire_attempt', {}, 0);
    timeline.addEvent('t1', 'Thread 1', 'lock_release', {}, 0);

    const t1Events = timeline.getEventsByThread('t1');
    expect(t1Events.length).toBe(2);
  });

  test('should filter events by type', () => {
    timeline.addEvent('t1', 'Thread 1', 'lock_acquire_success', {}, 0);
    timeline.addEvent('t2', 'Thread 2', 'lock_acquire_failed', {}, 0);
    timeline.addEvent('t1', 'Thread 1', 'lock_release', {}, 0);

    const successEvents = timeline.getEventsByType('lock_acquire_success');
    expect(successEvents.length).toBe(1);
  });

  test('should clear events', () => {
    timeline.addEvent('t1', 'Thread 1', 'lock_acquire_success', {}, 0);
    timeline.clear();
    expect(timeline.getEvents().length).toBe(0);
  });
});

describe('MockMutex', () => {
  let time: MockTime;
  let timeline: EventTimeline;
  let scheduler: MockThreadScheduler;
  let mutex: MockMutex;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
    scheduler = new MockThreadScheduler(time, timeline);
    mutex = new MockMutex('test-mutex', time, timeline, scheduler);
  });

  test('should acquire lock when not locked', () => {
    const result = mutex.lock('t1', 'Thread 1');
    expect(result).toBe(true);
    expect(mutex.isLocked()).toBe(true);
    expect(mutex.getOwner()).toBe('t1');
  });

  test('should fail to acquire lock when already locked', () => {
    mutex.lock('t1', 'Thread 1');
    const result = mutex.lock('t2', 'Thread 2');
    expect(result).toBe(false);
    expect(mutex.getWaitQueueSize()).toBe(1);
  });

  test('should release lock and wake waiting thread', () => {
    mutex.lock('t1', 'Thread 1');
    mutex.lock('t2', 'Thread 2');
    
    const awakened = mutex.unlock('t1', 'Thread 1');
    expect(awakened).toBe('t2');
    expect(mutex.isLocked()).toBe(false);
  });

  test('should not release lock when not owner', () => {
    mutex.lock('t1', 'Thread 1');
    const result = mutex.unlock('t2', 'Thread 2');
    expect(result).toBeNull();
    expect(mutex.isLocked()).toBe(true);
  });

  test('should reset correctly', () => {
    mutex.lock('t1', 'Thread 1');
    mutex.lock('t2', 'Thread 2');
    mutex.reset();
    
    expect(mutex.isLocked()).toBe(false);
    expect(mutex.getWaitQueueSize()).toBe(0);
  });
});

describe('MockRWLock', () => {
  let time: MockTime;
  let timeline: EventTimeline;
  let scheduler: MockThreadScheduler;
  let rwlock: MockRWLock;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
    scheduler = new MockThreadScheduler(time, timeline);
    rwlock = new MockRWLock('test-rwlock', time, timeline, scheduler);
  });

  test('should allow multiple readers', () => {
    const result1 = rwlock.readLock('t1', 'Thread 1');
    const result2 = rwlock.readLock('t2', 'Thread 2');
    
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(rwlock.getReadCount()).toBe(2);
  });

  test('should block writers when readers hold lock', () => {
    rwlock.readLock('t1', 'Thread 1');
    const result = rwlock.writeLock('t2', 'Thread 2');
    
    expect(result).toBe(false);
  });

  test('should block readers when writer holds lock', () => {
    rwlock.writeLock('t1', 'Thread 1');
    const result = rwlock.readLock('t2', 'Thread 2');
    
    expect(result).toBe(false);
    expect(rwlock.isWriteLocked()).toBe(true);
  });

  test('should release read lock correctly', () => {
    rwlock.readLock('t1', 'Thread 1');
    rwlock.readLock('t2', 'Thread 2');
    
    rwlock.readUnlock('t1', 'Thread 1');
    expect(rwlock.getReadCount()).toBe(1);
    
    rwlock.readUnlock('t2', 'Thread 2');
    expect(rwlock.getReadCount()).toBe(0);
  });

  test('should release write lock and wake waiting readers', () => {
    rwlock.writeLock('t1', 'Thread 1');
    rwlock.readLock('t2', 'Thread 2');
    rwlock.readLock('t3', 'Thread 3');
    
    const awakened = rwlock.writeUnlock('t1', 'Thread 1');
    expect(awakened.length).toBe(2);
  });
});

describe('MockSpinLock', () => {
  let time: MockTime;
  let timeline: EventTimeline;
  let scheduler: MockThreadScheduler;
  let spinlock: MockSpinLock;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
    scheduler = new MockThreadScheduler(time, timeline);
    spinlock = new MockSpinLock('test-spinlock', time, timeline, scheduler, 10);
  });

  test('should acquire lock when not locked', () => {
    const result = spinlock.lock('t1', 'Thread 1');
    expect(result).toBe(true);
    expect(spinlock.isLocked()).toBe(true);
  });

  test('should tryLock success when not locked', () => {
    const result = spinlock.tryLock('t1', 'Thread 1');
    expect(result).toBe(true);
  });

  test('should tryLock fail when locked', () => {
    spinlock.lock('t1', 'Thread 1');
    const result = spinlock.tryLock('t2', 'Thread 2');
    expect(result).toBe(false);
  });

  test('should count spin iterations', () => {
    spinlock.lock('t1', 'Thread 1');
    spinlock.lock('t2', 'Thread 2');
    
    expect(spinlock.getTotalSpinCount()).toBeGreaterThan(0);
  });

  test('should not unlock when not owner', () => {
    spinlock.lock('t1', 'Thread 1');
    const result = spinlock.unlock('t2', 'Thread 2');
    expect(result).toBe(false);
    expect(spinlock.isLocked()).toBe(true);
  });
});

describe('MockCAS', () => {
  let time: MockTime;
  let timeline: EventTimeline;
  let scheduler: MockThreadScheduler;
  let cas: MockCAS;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
    scheduler = new MockThreadScheduler(time, timeline);
    cas = new MockCAS(0, time, timeline, scheduler);
  });

  test('should get initial value', () => {
    expect(cas.getValue()).toBe(0);
    expect(cas.getVersion()).toBe(1);
  });

  test('should succeed when expected matches actual', () => {
    const result = cas.compareAndSwap('t1', 'Thread 1', 0, 10);
    expect(result.success).toBe(true);
    expect(result.actualValue).toBe(0);
    expect(cas.getValue()).toBe(10);
    expect(cas.getVersion()).toBe(2);
  });

  test('should fail when expected does not match actual', () => {
    const result = cas.compareAndSwap('t1', 'Thread 1', 1, 10);
    expect(result.success).toBe(false);
    expect(result.actualValue).toBe(0);
    expect(cas.getValue()).toBe(0);
  });

  test('should use version tag to detect ABA', () => {
    cas.setValue(100, 't1', 'Thread 1');
    const version1 = cas.getVersion();
    
    cas.setValue(200, 't2', 'Thread 2');
    cas.setValue(100, 't2', 'Thread 2');
    
    const result = cas.compareAndSwapWithVersion('t1', 'Thread 1', 100, version1, 300);
    expect(result.success).toBe(false);
  });

  test('should record operations', () => {
    cas.compareAndSwap('t1', 'Thread 1', 0, 10);
    cas.compareAndSwap('t2', 'Thread 2', 10, 20);
    
    const operations = cas.getOperations();
    expect(operations.length).toBe(2);
  });
});

describe('MockLockFreeQueue', () => {
  let time: MockTime;
  let timeline: EventTimeline;
  let scheduler: MockThreadScheduler;
  let queue: MockLockFreeQueue<number>;

  beforeEach(() => {
    time = new MockTime();
    timeline = new EventTimeline(time);
    scheduler = new MockThreadScheduler(time, timeline);
    queue = new MockLockFreeQueue<number>(time, timeline, scheduler);
  });

  test('should be empty initially', () => {
    expect(queue.isEmpty()).toBe(true);
    expect(queue.getSize()).toBe(0);
  });

  test('should enqueue items', () => {
    queue.enqueue('t1', 'Thread 1', 10);
    queue.enqueue('t2', 'Thread 2', 20);
    
    expect(queue.getSize()).toBe(2);
    expect(queue.isEmpty()).toBe(false);
  });

  test('should dequeue items', () => {
    queue.enqueue('t1', 'Thread 1', 10);
    queue.enqueue('t2', 'Thread 2', 20);
    
    const result1 = queue.dequeue('t3', 'Thread 3');
    expect(result1.value).toBe(10);
    expect(result1.isEmpty).toBe(false);
    
    const result2 = queue.dequeue('t4', 'Thread 4');
    expect(result2.value).toBe(20);
  });

  test('should return null when dequeuing empty queue', () => {
    const result = queue.dequeue('t1', 'Thread 1');
    expect(result.value).toBeNull();
    expect(result.isEmpty).toBe(true);
  });

  test('should update versions on enqueue/dequeue', () => {
    const initialHeadVersion = queue.getHeadVersion();
    const initialTailVersion = queue.getTailVersion();
    
    queue.enqueue('t1', 'Thread 1', 10);
    expect(queue.getTailVersion()).toBeGreaterThan(initialTailVersion);
    
    queue.dequeue('t2', 'Thread 2');
    expect(queue.getHeadVersion()).toBeGreaterThan(initialHeadVersion);
  });
});

describe('SimulationEngine', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  test('should have examples', () => {
    const examples = engine.getExamples();
    expect(examples.length).toBeGreaterThan(0);
  });

  test('should run mutex simulation', () => {
    const result = engine.run({
      threadCount: 2,
      lockType: 'mutex',
      operationSequence: [],
      contentionLevel: 'medium',
      enableABAReproduction: false,
      duration: 5,
    });

    expect(result.threads.length).toBe(2);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.metrics.totalOperations).toBeGreaterThan(0);
  });

  test('should run CAS simulation', () => {
    const result = engine.run({
      threadCount: 3,
      lockType: 'cas',
      operationSequence: [],
      contentionLevel: 'high',
      enableABAReproduction: false,
      duration: 10,
    });

    expect(result.casOperations.length).toBeGreaterThan(0);
  });

  test('should run ABA demo', () => {
    const result = engine.runABADemo('cas');
    
    expect(result).toBeDefined();
    expect(result.threads.length).toBe(2);
  });

  test('should run version-tagged ABA demo', () => {
    const result = engine.runABADemo('version-tagged');
    
    expect(result).toBeDefined();
  });

  test('should generate correct metrics', () => {
    const result = engine.run({
      threadCount: 4,
      lockType: 'spinlock',
      operationSequence: [],
      contentionLevel: 'high',
      enableABAReproduction: false,
      duration: 8,
    });

    expect(result.metrics.totalOperations).toBeGreaterThan(0);
    expect(result.metrics.successfulOperations).toBeGreaterThanOrEqual(0);
    expect(result.metrics.throughput).toBeGreaterThanOrEqual(0);
  });
});
