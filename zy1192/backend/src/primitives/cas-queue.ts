import { CASOperation, ABAEvent, TimelineEvent } from '../types';
import { MockTime, EventTimeline, MockThreadScheduler } from '../utils/mock-utils';

export class MockCAS {
  private value: number;
  private version: number;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private operations: CASOperation[];

  constructor(
    initialValue: number,
    time: MockTime,
    timeline: EventTimeline,
    scheduler: MockThreadScheduler
  ) {
    this.value = initialValue;
    this.version = 1;
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.operations = [];
  }

  compareAndSwap(
    threadId: string,
    threadName: string,
    expected: number,
    newValue: number
  ): { success: boolean; actualValue: number; version: number } {
    const opId = `cas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.timeline.addEvent(
      threadId,
      threadName,
      'cas_attempt',
      { expected, newValue, currentValue: this.value, version: this.version },
      0
    );

    const actualValue = this.value;
    const success = this.value === expected;

    if (success) {
      this.value = newValue;
      this.version++;

      this.timeline.addEvent(
        threadId,
        threadName,
        'cas_success',
        { expected, newValue, newVersion: this.version },
        0.5
      );
    } else {
      this.timeline.addEvent(
        threadId,
        threadName,
        'cas_failed',
        { expected, actualValue, newValue },
        0.5
      );
    }

    const operation: CASOperation = {
      id: opId,
      threadId,
      expected,
      newValue,
      success,
      actualValue,
      timestamp: this.time.now,
    };
    this.operations.push(operation);

    return { success, actualValue, version: this.version };
  }

  compareAndSwapWithVersion(
    threadId: string,
    threadName: string,
    expectedValue: number,
    expectedVersion: number,
    newValue: number
  ): { success: boolean; actualValue: number; actualVersion: number } {
    const opId = `casv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.timeline.addEvent(
      threadId,
      threadName,
      'cas_attempt',
      {
        expectedValue,
        expectedVersion,
        newValue,
        currentValue: this.value,
        currentVersion: this.version,
        mode: 'version-tagged',
      },
      0
    );

    const actualValue = this.value;
    const actualVersion = this.version;
    const success = this.value === expectedValue && this.version === expectedVersion;

    if (success) {
      this.value = newValue;
      this.version++;

      this.timeline.addEvent(
        threadId,
        threadName,
        'cas_success',
        { expectedValue, expectedVersion, newValue, newVersion: this.version, mode: 'version-tagged' },
        0.5
      );
    } else {
      this.timeline.addEvent(
        threadId,
        threadName,
        'cas_failed',
        {
          expectedValue,
          expectedVersion,
          actualValue,
          actualVersion,
          newValue,
          mode: 'version-tagged',
          reason: actualValue !== expectedValue ? 'value mismatch' : 'version mismatch',
        },
        0.5
      );
    }

    const operation: CASOperation = {
      id: opId,
      threadId,
      expected: expectedValue,
      newValue,
      success,
      actualValue,
      timestamp: this.time.now,
    };
    this.operations.push(operation);

    return { success, actualValue, actualVersion };
  }

  getValue(): number {
    return this.value;
  }

  getVersion(): number {
    return this.version;
  }

  setValue(value: number, threadId: string, threadName: string): void {
    this.timeline.addEvent(
      threadId,
      threadName,
      'cas_attempt',
      { action: 'direct_set', oldValue: this.value, newValue: value },
      0
    );

    this.value = value;
    this.version++;

    this.timeline.addEvent(
      threadId,
      threadName,
      'cas_success',
      { action: 'direct_set', newValue: value, newVersion: this.version },
      0.1
    );
  }

  getOperations(): CASOperation[] {
    return [...this.operations];
  }

  getSuccessRate(): number {
    if (this.operations.length === 0) return 1;
    const successCount = this.operations.filter((op) => op.success).length;
    return successCount / this.operations.length;
  }

  reset(initialValue: number = 0): void {
    this.value = initialValue;
    this.version = 1;
    this.operations = [];
  }
}

interface Node<T> {
  value: T;
  version: number;
}

export class MockLockFreeQueue<T> {
  private queue: Node<T>[];
  private headVersion: number;
  private tailVersion: number;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private abaEvents: ABAEvent[];
  private lastDequeuedValue?: T;
  private lastDequeuedVersion: number;

  constructor(
    time: MockTime,
    timeline: EventTimeline,
    scheduler: MockThreadScheduler
  ) {
    this.queue = [];
    this.headVersion = 1;
    this.tailVersion = 1;
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.abaEvents = [];
    this.lastDequeuedVersion = 0;
  }

  enqueue(threadId: string, threadName: string, value: T): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'enqueue_attempt',
      { value, tailVersion: this.tailVersion, queueSize: this.queue.length },
      0
    );

    const node: Node<T> = {
      value,
      version: this.tailVersion,
    };

    const beforeSize = this.queue.length;
    const beforeTailVersion = this.tailVersion;

    this.queue.push(node);
    this.tailVersion++;

    const isABA = this.checkABAOnEnqueue(threadId, value, beforeSize, beforeTailVersion);

    this.timeline.addEvent(
      threadId,
      threadName,
      'enqueue_success',
      {
        value,
        oldTailVersion: beforeTailVersion,
        newTailVersion: this.tailVersion,
        newQueueSize: this.queue.length,
        isABA,
      },
      0.3
    );

    if (isABA) {
      this.recordABAEvent(threadId, 'enqueue', this.lastDequeuedValue, value, this.lastDequeuedVersion, this.tailVersion - 1);
    }

    return true;
  }

  dequeue(threadId: string, threadName: string): { value: T | null; version: number; isEmpty: boolean } {
    this.timeline.addEvent(
      threadId,
      threadName,
      'dequeue_attempt',
      { headVersion: this.headVersion, queueSize: this.queue.length },
      0
    );

    if (this.queue.length === 0) {
      this.timeline.addEvent(
        threadId,
        threadName,
        'dequeue_attempt',
        { reason: 'queue_empty', headVersion: this.headVersion },
        0.1
      );
      return { value: null, version: this.headVersion, isEmpty: true };
    }

    const beforeSize = this.queue.length;
    const beforeHeadVersion = this.headVersion;
    const node = this.queue[0];

    this.queue.shift();
    this.headVersion++;

    const isABA = this.checkABAOnDequeue(threadId, node.value, beforeSize, beforeHeadVersion);

    this.lastDequeuedValue = node.value;
    this.lastDequeuedVersion = beforeHeadVersion;

    this.timeline.addEvent(
      threadId,
      threadName,
      'dequeue_success',
      {
        value: node.value,
        nodeVersion: node.version,
        oldHeadVersion: beforeHeadVersion,
        newHeadVersion: this.headVersion,
        newQueueSize: this.queue.length,
        isABA,
      },
      0.3
    );

    if (isABA) {
      this.recordABAEvent(threadId, 'dequeue', this.lastDequeuedValue, node.value, this.lastDequeuedVersion, beforeHeadVersion);
    }

    return { value: node.value, version: this.headVersion - 1, isEmpty: false };
  }

  peek(threadId: string, threadName: string): { value: T | null; version: number } {
    if (this.queue.length === 0) {
      return { value: null, version: this.headVersion };
    }

    const node = this.queue[0];
    return { value: node.value, version: node.version };
  }

  private checkABAOnEnqueue(
    _threadId: string,
    value: T,
    _beforeSize: number,
    _beforeVersion: number
  ): boolean {
    if (this.lastDequeuedValue === undefined) return false;

    return JSON.stringify(this.lastDequeuedValue) === JSON.stringify(value);
  }

  private checkABAOnDequeue(
    _threadId: string,
    value: T,
    _beforeSize: number,
    _beforeVersion: number
  ): boolean {
    if (this.lastDequeuedValue === undefined) return false;

    return JSON.stringify(this.lastDequeuedValue) === JSON.stringify(value);
  }

  private recordABAEvent(
    threadId: string,
    type: 'enqueue' | 'dequeue' | 'peek',
    beforeValue: T | undefined,
    afterValue: T,
    beforeVersion: number,
    afterVersion: number
  ): void {
    const event: ABAEvent = {
      type,
      threadId,
      beforeValue: beforeValue as number,
      afterValue: afterValue as number,
      beforeVersion,
      afterVersion,
      timestamp: this.time.now,
      isABA: true,
    };
    this.abaEvents.push(event);

    this.timeline.addEvent(
      threadId,
      `Thread-${threadId}`,
      'aba_detected',
      {
        type,
        beforeValue,
        afterValue,
        beforeVersion,
        afterVersion,
      },
      0
    );
  }

  getSize(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getHeadVersion(): number {
    return this.headVersion;
  }

  getTailVersion(): number {
    return this.tailVersion;
  }

  getABAEvents(): ABAEvent[] {
    return [...this.abaEvents];
  }

  getABACount(): number {
    return this.abaEvents.length;
  }

  getState(): { size: number; head: number | null; tail: number | null; version: number } {
    return {
      size: this.queue.length,
      head: this.queue.length > 0 ? (this.queue[0].value as number) : null,
      tail: this.queue.length > 0 ? (this.queue[this.queue.length - 1].value as number) : null,
      version: this.headVersion,
    };
  }

  reset(): void {
    this.queue = [];
    this.headVersion = 1;
    this.tailVersion = 1;
    this.abaEvents = [];
    this.lastDequeuedValue = undefined;
    this.lastDequeuedVersion = 0;
  }
}

export class ABASimulator {
  private cas: MockCAS;
  private queue: MockLockFreeQueue<number>;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;

  constructor(
    time: MockTime,
    timeline: EventTimeline,
    scheduler: MockThreadScheduler
  ) {
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.cas = new MockCAS(0, time, timeline, scheduler);
    this.queue = new MockLockFreeQueue<number>(time, timeline, scheduler);
  }

  simulateABAWithCAS(threadId1: string, threadId2: string): {
    events: ABAEvent[];
    operations: CASOperation[];
    description: string;
  } {
    const t1Name = `Thread-${threadId1}`;
    const t2Name = `Thread-${threadId2}`;

    this.cas.reset(100);

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'cas_attempt',
      { action: 'read_A', value: 100, phase: 'step1' },
      0
    );

    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'cas_attempt',
      { action: 'modify_to_B', oldValue: 100, newValue: 200, phase: 'step2' },
      0
    );

    this.cas.compareAndSwap(threadId2, t2Name, 100, 200);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'cas_attempt',
      { action: 'restore_to_A', oldValue: 200, newValue: 100, phase: 'step3' },
      0
    );

    this.cas.compareAndSwap(threadId2, t2Name, 200, 100);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'cas_attempt',
      { action: 'cas_A_success', expected: 100, newValue: 300, phase: 'step4', note: 'ABA occurred!' },
      0
    );

    const result = this.cas.compareAndSwap(threadId1, t1Name, 100, 300);

    return {
      events: [],
      operations: this.cas.getOperations(),
      description: `ABA 问题演示：
1. Thread-${threadId1} 读取值 A (100)
2. Thread-${threadId2} 将值修改为 B (200)
3. Thread-${threadId2} 将值修改回 A (100)
4. Thread-${threadId1} 执行 CAS，预期为 A (100)，成功！
结果：CAS 成功了，但实际上数据已经被修改过了（A->B->A），这就是 ABA 问题。
${result.success ? 'CAS 成功，ABA 问题已复现！' : 'CAS 失败'}`,
    };
  }

  simulateABAWithQueue(threadId1: string, threadId2: string): {
    events: ABAEvent[];
    description: string;
  } {
    const t1Name = `Thread-${threadId1}`;
    const t2Name = `Thread-${threadId2}`;

    this.queue.reset();

    const nodeA = 100;
    const nodeB = 200;
    const nodeC = 300;

    this.timeline.addEvent(
      'init',
      'System',
      'enqueue_attempt',
      { action: 'init_queue', values: [nodeA, nodeB], phase: 'initial' },
      0
    );

    this.queue.enqueue('init', 'System', nodeA);
    this.queue.enqueue('init', 'System', nodeB);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'dequeue_attempt',
      { action: 'start_dequeue_A', headValue: nodeA, phase: 'step1' },
      0
    );

    this.time.advance(0.5);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'dequeue_attempt',
      { action: 'dequeue_A', headValue: nodeA, phase: 'step2' },
      0
    );

    const dequeueResult = this.queue.dequeue(threadId2, t2Name);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'dequeue_attempt',
      { action: 'dequeue_B', headValue: nodeB, phase: 'step3' },
      0
    );

    this.queue.dequeue(threadId2, t2Name);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'enqueue_attempt',
      { action: 'recycle_A', value: nodeA, phase: 'step4' },
      0
    );

    this.queue.enqueue(threadId2, t2Name, nodeA);
    this.time.advance(1);

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'dequeue_attempt',
      { action: 'continue_dequeue', expectedHead: nodeA, phase: 'step5', note: 'ABA occurred!' },
      0
    );

    const finalResult = this.queue.dequeue(threadId1, t1Name);

    return {
      events: this.queue.getABAEvents(),
      description: `无锁队列 ABA 问题演示：
1. 初始队列: [A(100), B(200)]
2. Thread-${threadId1} 开始出队操作，读取 head 指针指向 A
3. Thread-${threadId2} 出队 A，再出队 B
4. Thread-${threadId2} 回收节点 A，重新入队 A
5. Thread-${threadId1} 继续出队，发现 head 还是指向 A，CAS 成功！
结果：Thread-${threadId1} 认为成功出队了原来的 A，但队列结构已经完全改变了。
实际出队的值: ${finalResult.value}
ABA 事件数量: ${this.queue.getABACount()}`,
    };
  }

  simulateABAWithVersionTaggedCAS(threadId1: string, threadId2: string): {
    events: ABAEvent[];
    operations: CASOperation[];
    description: string;
  } {
    const t1Name = `Thread-${threadId1}`;
    const t2Name = `Thread-${threadId2}`;

    this.cas.reset(100);

    const initialValue = this.cas.getValue();
    const initialVersion = this.cas.getVersion();

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'cas_attempt',
      { action: 'read_A_with_version', value: initialValue, version: initialVersion, mode: 'version-tagged', phase: 'step1' },
      0
    );

    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'cas_attempt',
      { action: 'modify_to_B', oldValue: 100, newValue: 200, phase: 'step2' },
      0
    );

    this.cas.compareAndSwap(threadId2, t2Name, 100, 200);
    const versionAfterStep2 = this.cas.getVersion();
    this.time.advance(1);

    this.timeline.addEvent(
      threadId2,
      t2Name,
      'cas_attempt',
      { action: 'restore_to_A', oldValue: 200, newValue: 100, phase: 'step3' },
      0
    );

    this.cas.compareAndSwap(threadId2, t2Name, 200, 100);
    const versionAfterStep3 = this.cas.getVersion();
    this.time.advance(1);

    this.timeline.addEvent(
      threadId1,
      t1Name,
      'cas_attempt',
      {
        action: 'cas_with_version_check',
        expectedValue: initialValue,
        expectedVersion: initialVersion,
        actualVersion: versionAfterStep3,
        newValue: 300,
        mode: 'version-tagged',
        phase: 'step4',
        note: 'Version mismatch detected!',
      },
      0
    );

    const result = this.cas.compareAndSwapWithVersion(
      threadId1,
      t1Name,
      initialValue,
      initialVersion,
      300
    );

    return {
      events: [],
      operations: this.cas.getOperations(),
      description: `带版本戳的 CAS 解决 ABA 问题：
1. Thread-${threadId1} 读取值 A (100) 及版本号 v${initialVersion}
2. Thread-${threadId2} 将值修改为 B (200)，版本号变为 v${versionAfterStep2}
3. Thread-${threadId2} 将值修改回 A (100)，版本号变为 v${versionAfterStep3}
4. Thread-${threadId1} 执行带版本戳的 CAS：
   - 预期值: 100 (A) ✓
   - 预期版本: v${initialVersion} ✗ (实际为 v${versionAfterStep3})
   - 新版本: v${result.actualVersion}

结果：CAS ${result.success ? '成功' : '失败'}！
${result.success 
  ? '警告：版本戳机制应该能检测到 ABA 问题！' 
  : '版本戳机制成功检测到 ABA 问题，CAS 失败！这正是我们期望的行为。'}

说明：使用版本戳（或引用计数）是解决 CAS 操作中 ABA 问题的标准方法。每次修改都增加版本号，即使值相同，版本号也不同。`,
    };
  }

  getCAS(): MockCAS {
    return this.cas;
  }

  getQueue(): MockLockFreeQueue<number> {
    return this.queue;
  }

  reset(): void {
    this.cas.reset();
    this.queue.reset();
  }
}
