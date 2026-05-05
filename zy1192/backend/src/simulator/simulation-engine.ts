import {
  Thread,
  LockState,
  CASOperation,
  ABAEvent,
  TimelineEvent,
  SimulationConfig,
  OperationStep,
  ABAStep,
  SimulationResult,
  Example,
} from '../types';
import { MockTime, EventTimeline, MockThreadScheduler } from '../utils/mock-utils';
import { MockMutex, MockRWLock, MockSpinLock } from '../primitives/locks';
import { MockCAS, MockLockFreeQueue, ABASimulator } from '../primitives/cas-queue';

export class SimulationEngine {
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private mutex?: MockMutex;
  private rwlock?: MockRWLock;
  private spinlock?: MockSpinLock;
  private cas?: MockCAS;
  private queue?: MockLockFreeQueue<number>;
  private abaSimulator?: ABASimulator;
  private threads: Map<string, Thread>;
  private casOperations: CASOperation[];
  private abaEvents: ABAEvent[];

  constructor() {
    this.time = new MockTime();
    this.timeline = new EventTimeline(this.time);
    this.scheduler = new MockThreadScheduler(this.time, this.timeline);
    this.threads = new Map();
    this.casOperations = [];
    this.abaEvents = [];
  }

  private initThreads(count: number): void {
    this.threads.clear();
    for (let i = 0; i < count; i++) {
      const threadId = `t${i + 1}`;
      const thread: Thread = {
        id: threadId,
        name: `Thread-${i + 1}`,
        state: 'idle',
        priority: 1,
        startTime: this.time.now,
      };
      this.threads.set(threadId, thread);
      this.scheduler.registerThread(threadId, thread.name);
    }
  }

  private initLocks(lockType: SimulationConfig['lockType']): void {
    switch (lockType) {
      case 'mutex':
        this.mutex = new MockMutex('mutex-1', this.time, this.timeline, this.scheduler);
        break;
      case 'rwlock':
        this.rwlock = new MockRWLock('rwlock-1', this.time, this.timeline, this.scheduler);
        break;
      case 'spinlock':
        this.spinlock = new MockSpinLock('spinlock-1', this.time, this.timeline, this.scheduler);
        break;
      case 'cas':
        this.cas = new MockCAS(0, this.time, this.timeline, this.scheduler);
        break;
      case 'lock-free-queue':
        this.queue = new MockLockFreeQueue<number>(this.time, this.timeline, this.scheduler);
        this.abaSimulator = new ABASimulator(this.time, this.timeline, this.scheduler);
        break;
    }
  }

  private getContentionDelay(contentionLevel: 'low' | 'medium' | 'high'): number {
    switch (contentionLevel) {
      case 'low':
        return Math.random() * 5 + 2;
      case 'medium':
        return Math.random() * 3 + 1;
      case 'high':
        return Math.random() * 1 + 0.1;
    }
  }

  private executeOperation(
    threadId: string,
    threadName: string,
    operation: OperationStep['operation'],
    config: SimulationConfig,
    value?: number,
    expectedValue?: number,
    _target?: string
  ): void {
    const delay = this.getContentionDelay(config.contentionLevel);

    switch (operation) {
      case 'lock':
        if (this.mutex) {
          this.mutex.lock(threadId, threadName);
        } else if (this.rwlock) {
          this.rwlock.writeLock(threadId, threadName);
        } else if (this.spinlock) {
          this.spinlock.lock(threadId, threadName);
        }
        this.time.advance(delay);
        break;

      case 'unlock':
        if (this.mutex) {
          this.mutex.unlock(threadId, threadName);
        } else if (this.rwlock) {
          this.rwlock.writeUnlock(threadId, threadName);
        } else if (this.spinlock) {
          this.spinlock.unlock(threadId, threadName);
        }
        this.time.advance(delay);
        break;

      case 'read':
        if (this.rwlock) {
          this.rwlock.readLock(threadId, threadName);
          this.time.advance(delay);
          this.rwlock.readUnlock(threadId, threadName);
        }
        break;

      case 'write':
        if (this.rwlock) {
          this.rwlock.writeLock(threadId, threadName);
          this.time.advance(delay);
          this.rwlock.writeUnlock(threadId, threadName);
        }
        break;

      case 'cas':
        if (this.cas && value !== undefined && expectedValue !== undefined) {
          this.cas.compareAndSwap(threadId, threadName, expectedValue, value);
        } else if (this.cas && value !== undefined) {
          const currentValue = this.cas.getValue();
          this.cas.compareAndSwap(threadId, threadName, currentValue, value);
        }
        this.time.advance(delay);
        break;

      case 'enqueue':
        if (this.queue && value !== undefined) {
          this.queue.enqueue(threadId, threadName, value);
        }
        this.time.advance(delay);
        break;

      case 'dequeue':
        if (this.queue) {
          this.queue.dequeue(threadId, threadName);
        }
        this.time.advance(delay);
        break;
    }
  }

  private executeABASteps(abaSteps: ABAStep[]): void {
    if (!this.abaSimulator) return;

    for (const step of abaSteps) {
      const threadId = step.threadId;
      const threadName = `Thread-${threadId}`;

      switch (step.action) {
        case 'read':
          if (this.cas) {
            this.timeline.addEvent(
              threadId,
              threadName,
              'cas_attempt',
              { action: 'read', value: this.cas.getValue(), description: step.description },
              0
            );
          }
          break;
        case 'modify':
          if (this.cas) {
            const currentValue = this.cas.getValue();
            this.cas.setValue(currentValue + 1, threadId, threadName);
          }
          break;
        case 'restore':
          if (this.cas) {
            const currentValue = this.cas.getValue();
            this.cas.setValue(currentValue - 1, threadId, threadName);
          }
          break;
      }

      this.time.advance(step.delay);
    }
  }

  private generateDefaultOperations(config: SimulationConfig): OperationStep[] {
    const operations: OperationStep[] = [];
    const threadIds = Array.from(this.threads.keys());

    switch (config.lockType) {
      case 'mutex':
      case 'spinlock':
        for (let i = 0; i < config.duration; i++) {
          for (const threadId of threadIds) {
            operations.push({
              threadId,
              operation: 'lock',
              delay: 1,
            });
            operations.push({
              threadId,
              operation: 'unlock',
              delay: 1,
            });
          }
        }
        break;

      case 'rwlock':
        for (let i = 0; i < config.duration; i++) {
          for (let j = 0; j < threadIds.length; j++) {
            const threadId = threadIds[j];
            const isWriter = j < Math.ceil(threadIds.length / 3);
            operations.push({
              threadId,
              operation: isWriter ? 'write' : 'read',
              delay: 1,
            });
          }
        }
        break;

      case 'cas':
        for (let i = 0; i < config.duration; i++) {
          for (const threadId of threadIds) {
            operations.push({
              threadId,
              operation: 'cas',
              value: Math.floor(Math.random() * 100),
              delay: 1,
            });
          }
        }
        break;

      case 'lock-free-queue':
        for (let i = 0; i < config.duration; i++) {
          for (let j = 0; j < threadIds.length; j++) {
            const threadId = threadIds[j];
            const isEnqueue = j % 2 === 0;
            operations.push({
              threadId,
              operation: isEnqueue ? 'enqueue' : 'dequeue',
              value: isEnqueue ? Math.floor(Math.random() * 100) : undefined,
              delay: 1,
            });
          }
        }
        break;
    }

    return operations;
  }

  run(config: SimulationConfig): SimulationResult {
    this.time.reset();
    this.timeline.clear();
    this.scheduler.reset();
    this.casOperations = [];
    this.abaEvents = [];

    this.initThreads(config.threadCount);
    this.initLocks(config.lockType);

    let operations = config.operationSequence;
    if (operations.length === 0) {
      operations = this.generateDefaultOperations(config);
    }

    for (const thread of this.threads.values()) {
      this.scheduler.runThread(thread.id, thread.name, 0.1);
    }

    for (const op of operations) {
      const thread = this.threads.get(op.threadId);
      if (thread) {
        this.executeOperation(
          op.threadId,
          thread.name,
          op.operation,
          config,
          op.value,
          op.expectedValue,
          op.target
        );
      }
      this.time.advance(op.delay);
    }

    if (config.enableABAReproduction && config.abaSteps && config.abaSteps.length > 0) {
      this.executeABASteps(config.abaSteps);
    }

    for (const thread of this.threads.values()) {
      this.scheduler.finishThread(thread.id, thread.name);
      thread.endTime = this.time.now;
    }

    this.timeline.sortByTime();

    if (this.cas) {
      this.casOperations = this.cas.getOperations();
    }
    if (this.queue) {
      this.abaEvents = this.queue.getABAEvents();
    }

    const result = this.calculateMetrics(config);
    return result;
  }

  runABADemo(mode: 'cas' | 'queue' | 'version-tagged'): SimulationResult {
    this.time.reset();
    this.timeline.clear();
    this.scheduler.reset();
    this.abaEvents = [];
    this.casOperations = [];

    this.initThreads(2);

    const t1 = this.threads.get('t1');
    const t2 = this.threads.get('t2');

    if (!t1 || !t2) {
      throw new Error('Threads not initialized');
    }

    this.abaSimulator = new ABASimulator(this.time, this.timeline, this.scheduler);
    this.cas = this.abaSimulator.getCAS();
    this.queue = this.abaSimulator.getQueue();

    this.scheduler.runThread('t1', t1.name, 0.1);
    this.scheduler.runThread('t2', t2.name, 0.1);

    let description = '';

    switch (mode) {
      case 'cas': {
        const result = this.abaSimulator.simulateABAWithCAS('t1', 't2');
        this.casOperations = result.operations;
        description = result.description;
        break;
      }
      case 'queue': {
        const result = this.abaSimulator.simulateABAWithQueue('t1', 't2');
        this.abaEvents = result.events;
        description = result.description;
        break;
      }
      case 'version-tagged': {
        const result = this.abaSimulator.simulateABAWithVersionTaggedCAS('t1', 't2');
        this.casOperations = result.operations;
        description = result.description;
        break;
      }
    }

    this.scheduler.finishThread('t1', t1.name);
    this.scheduler.finishThread('t2', t2.name);

    t1.endTime = this.time.now;
    t2.endTime = this.time.now;

    this.timeline.sortByTime();

    const config: SimulationConfig = {
      threadCount: 2,
      lockType: mode === 'queue' ? 'lock-free-queue' : 'cas',
      operationSequence: [],
      contentionLevel: 'high',
      enableABAReproduction: true,
      abaSteps: [],
      duration: 10,
    };

    const result = this.calculateMetrics(config);
    return {
      ...result,
      config: {
        ...config,
        abaSteps: [{
          threadId: 't1',
          action: 'read',
          description,
          delay: 1,
        }],
      },
    };
  }

  private calculateMetrics(config: SimulationConfig): SimulationResult {
    const events = this.timeline.getEvents();

    const totalOperations = events.filter((e) =>
      ['lock_acquire_success', 'lock_acquire_failed', 'cas_success', 'cas_failed', 'enqueue_success', 'dequeue_success'].includes(e.eventType)
    ).length;

    const successfulOperations = events.filter((e) =>
      ['lock_acquire_success', 'cas_success', 'enqueue_success', 'dequeue_success'].includes(e.eventType)
    ).length;

    const failedOperations = events.filter((e) =>
      ['lock_acquire_failed', 'cas_failed'].includes(e.eventType)
    ).length;

    const totalWaitTime = events
      .filter((e) => e.eventType === 'wait_end')
      .reduce((sum, e) => sum + e.cost, 0);

    const totalSpinTime = events
      .filter((e) => e.eventType === 'spin_end')
      .reduce((sum, e) => sum + e.cost, 0);

    const waitEvents = events.filter((e) => e.eventType === 'wait_end');
    const spinEvents = events.filter((e) => e.eventType === 'spin_end');

    const lockAttempts = events.filter((e) => e.eventType === 'lock_acquire_attempt').length;
    const lockFailures = events.filter((e) => e.eventType === 'lock_acquire_failed').length;

    const abaIncidents = events.filter((e) => e.eventType === 'aba_detected').length + this.abaEvents.length;

    const totalTime = this.time.now;
    const throughput = totalTime > 0 ? totalOperations / totalTime : 0;

    const lockStates = new Map<string, LockState>();
    const schedulerLockStates = this.scheduler.getLockStates();
    for (const [name, state] of schedulerLockStates.entries()) {
      lockStates.set(name, state);
    }

    return {
      config,
      threads: Array.from(this.threads.values()),
      timeline: events,
      lockStates,
      casOperations: this.casOperations,
      abaEvents: this.abaEvents,
      metrics: {
        totalOperations,
        successfulOperations,
        failedOperations,
        totalWaitTime,
        totalSpinTime,
        throughput,
        avgWaitTime: waitEvents.length > 0 ? totalWaitTime / waitEvents.length : 0,
        avgSpinTime: spinEvents.length > 0 ? totalSpinTime / spinEvents.length : 0,
        abaIncidents,
        contentionRate: lockAttempts > 0 ? lockFailures / lockAttempts : 0,
      },
      queueState: this.queue?.getState(),
    };
  }

  getExamples(): Example[] {
    return [
      {
        id: 'mutex-basic',
        name: 'Mutex 基础示例',
        description: '演示两个线程竞争互斥锁的基本场景',
        config: {
          threadCount: 2,
          lockType: 'mutex',
          operationSequence: [
            { threadId: 't1', operation: 'lock', delay: 1 },
            { threadId: 't2', operation: 'lock', delay: 1 },
            { threadId: 't1', operation: 'unlock', delay: 1 },
            { threadId: 't2', operation: 'unlock', delay: 1 },
          ],
          contentionLevel: 'high',
          enableABAReproduction: false,
          duration: 10,
        },
        expectedOutcome: '线程 t1 先获取锁，线程 t2 需要等待 t1 释放锁后才能获取',
      },
      {
        id: 'rwlock-read-heavy',
        name: '读写锁 - 读多写少场景',
        description: '演示读写锁在读多写少场景下的性能优势',
        config: {
          threadCount: 4,
          lockType: 'rwlock',
          operationSequence: [
            { threadId: 't1', operation: 'read', delay: 1 },
            { threadId: 't2', operation: 'read', delay: 1 },
            { threadId: 't3', operation: 'write', delay: 2 },
            { threadId: 't4', operation: 'read', delay: 1 },
          ],
          contentionLevel: 'medium',
          enableABAReproduction: false,
          duration: 10,
        },
        expectedOutcome: '多个读线程可以同时获取读锁，写线程会阻塞所有读操作',
      },
      {
        id: 'spinlock-contention',
        name: '自旋锁高竞争场景',
        description: '演示自旋锁在高竞争下的性能开销',
        config: {
          threadCount: 5,
          lockType: 'spinlock',
          operationSequence: [],
          contentionLevel: 'high',
          enableABAReproduction: false,
          duration: 5,
        },
        expectedOutcome: '观察自旋等待的时间开销，对比 Mutex 的阻塞等待',
      },
      {
        id: 'cas-basic',
        name: 'CAS 基础操作',
        description: '演示比较并交换操作的成功与失败场景',
        config: {
          threadCount: 3,
          lockType: 'cas',
          operationSequence: [
            { threadId: 't1', operation: 'cas', expectedValue: 0, value: 10, delay: 1 },
            { threadId: 't2', operation: 'cas', expectedValue: 0, value: 20, delay: 1 },
            { threadId: 't3', operation: 'cas', expectedValue: 10, value: 30, delay: 1 },
          ],
          contentionLevel: 'high',
          enableABAReproduction: false,
          duration: 10,
        },
        expectedOutcome: 't1 成功将 0 改为 10；t2 尝试将 0 改为 20 失败（值已为 10）；t3 成功将 10 改为 30',
      },
      {
        id: 'aba-cas-demo',
        name: 'ABA 问题 - CAS 场景',
        description: '演示 CAS 操作中的 ABA 问题',
        config: {
          threadCount: 2,
          lockType: 'cas',
          operationSequence: [],
          contentionLevel: 'high',
          enableABAReproduction: true,
          abaSteps: [
            { threadId: 't1', action: 'read', description: 'Thread 1 读取值 A (100)', delay: 1 },
            { threadId: 't2', action: 'modify', description: 'Thread 2 将值改为 B (200)', delay: 1 },
            { threadId: 't2', action: 'restore', description: 'Thread 2 将值改回 A (100)', delay: 1 },
            { threadId: 't1', action: 'read', description: 'Thread 1 执行 CAS，预期为 A，成功！但值已经被修改过', delay: 1 },
          ],
          duration: 10,
        },
        expectedOutcome: 'Thread 1 的 CAS 操作虽然成功了，但数据实际上已经被修改过（A->B->A），这就是 ABA 问题',
      },
      {
        id: 'aba-version-tagged',
        name: 'ABA 问题 - 版本戳解决方案',
        description: '演示如何使用版本戳解决 ABA 问题',
        config: {
          threadCount: 2,
          lockType: 'cas',
          operationSequence: [],
          contentionLevel: 'high',
          enableABAReproduction: true,
          abaSteps: [
            { threadId: 't1', action: 'read', description: 'Thread 1 读取值 A (100) 及版本号 v1', delay: 1 },
            { threadId: 't2', action: 'modify', description: 'Thread 2 将值改为 B (200)，版本号变为 v2', delay: 1 },
            { threadId: 't2', action: 'restore', description: 'Thread 2 将值改回 A (100)，版本号变为 v3', delay: 1 },
            { threadId: 't1', action: 'read', description: 'Thread 1 执行带版本戳的 CAS：预期值 100 匹配，但版本号 v1 不匹配 v3，CAS 失败！', delay: 1 },
          ],
          duration: 10,
        },
        expectedOutcome: '使用版本戳后，即使值相同（都是 A），版本号不同也会导致 CAS 失败，从而检测到 ABA 问题',
      },
    ];
  }
}
