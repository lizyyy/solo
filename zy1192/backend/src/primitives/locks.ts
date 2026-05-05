import { LockState, TimelineEvent } from '../types';
import { MockTime, EventTimeline, WaitQueue, MockThreadScheduler } from '../utils/mock-utils';

export class MockMutex {
  private state: LockState;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private waitQueue: WaitQueue;

  constructor(name: string, time: MockTime, timeline: EventTimeline, scheduler: MockThreadScheduler) {
    this.state = {
      type: 'mutex',
      name,
      isLocked: false,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.waitQueue = new WaitQueue();
    
    this.scheduler.registerLock(this.state);
  }

  lock(threadId: string, threadName: string): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_attempt',
      { lockName: this.state.name },
      0,
      this.state.name
    );

    if (this.state.isLocked) {
      this.waitQueue.add(threadId, this.time.now);
      this.scheduler.block(threadId, threadName, this.state.name);
      return false;
    }

    this.state.isLocked = true;
    this.state.ownerThreadId = threadId;
    this.state.writeCount++;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_success',
      { lockName: this.state.name },
      0,
      this.state.name
    );

    this.scheduler.updateLockState(this.state.name, this.state);
    return true;
  }

  unlock(threadId: string, threadName: string): string | null {
    if (!this.state.isLocked || this.state.ownerThreadId !== threadId) {
      this.timeline.addEvent(
        threadId,
        threadName,
        'lock_acquire_failed',
        { lockName: this.state.name, reason: 'not owner' },
        0,
        this.state.name
      );
      return null;
    }

    this.state.isLocked = false;
    this.state.ownerThreadId = undefined;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_release',
      { lockName: this.state.name },
      0,
      this.state.name
    );

    const waitingThread = this.waitQueue.removeFirst();
    if (waitingThread) {
      const waitTime = this.waitQueue.getWaitTime(waitingThread, this.time.now);
      this.scheduler.updateLockState(this.state.name, {
        ...this.state,
        waitingThreads: this.waitQueue.getThreads(),
      });
      
      this.timeline.addEvent(
        waitingThread,
        `Thread-${waitingThread}`,
        'wait_end',
        { lockName: this.state.name, waitTime },
        waitTime,
        this.state.name
      );
    } else {
      this.scheduler.updateLockState(this.state.name, this.state);
    }

    return waitingThread;
  }

  isLocked(): boolean {
    return this.state.isLocked;
  }

  getOwner(): string | undefined {
    return this.state.ownerThreadId;
  }

  getState(): LockState {
    return { ...this.state, waitingThreads: this.waitQueue.getThreads() };
  }

  getWaitQueueSize(): number {
    return this.waitQueue.size();
  }

  reset(): void {
    this.state = {
      type: 'mutex',
      name: this.state.name,
      isLocked: false,
      ownerThreadId: undefined,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.waitQueue.clear();
    this.scheduler.registerLock(this.state);
  }
}

export class MockRWLock {
  private state: LockState;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private readWaitQueue: WaitQueue;
  private writeWaitQueue: WaitQueue;
  private ownerThreadId?: string;

  constructor(name: string, time: MockTime, timeline: EventTimeline, scheduler: MockThreadScheduler) {
    this.state = {
      type: 'rwlock',
      name,
      isLocked: false,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.readWaitQueue = new WaitQueue();
    this.writeWaitQueue = new WaitQueue();
    
    this.scheduler.registerLock(this.state);
  }

  readLock(threadId: string, threadName: string): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_attempt',
      { lockName: this.state.name, lockType: 'read' },
      0,
      this.state.name
    );

    if (this.state.isLocked && this.ownerThreadId !== undefined) {
      this.readWaitQueue.add(threadId, this.time.now);
      this.scheduler.block(threadId, threadName, this.state.name);
      return false;
    }

    this.state.isLocked = true;
    this.state.readCount++;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_success',
      { lockName: this.state.name, lockType: 'read', readCount: this.state.readCount },
      0,
      this.state.name
    );

    this.scheduler.updateLockState(this.state.name, {
      ...this.state,
      waitingThreads: [...this.readWaitQueue.getThreads(), ...this.writeWaitQueue.getThreads()],
    });
    return true;
  }

  writeLock(threadId: string, threadName: string): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_attempt',
      { lockName: this.state.name, lockType: 'write' },
      0,
      this.state.name
    );

    if (this.state.isLocked) {
      this.writeWaitQueue.add(threadId, this.time.now);
      this.scheduler.block(threadId, threadName, this.state.name);
      return false;
    }

    this.state.isLocked = true;
    this.state.writeCount++;
    this.ownerThreadId = threadId;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_success',
      { lockName: this.state.name, lockType: 'write' },
      0,
      this.state.name
    );

    this.scheduler.updateLockState(this.state.name, {
      ...this.state,
      ownerThreadId: this.ownerThreadId,
      waitingThreads: [...this.readWaitQueue.getThreads(), ...this.writeWaitQueue.getThreads()],
    });
    return true;
  }

  readUnlock(threadId: string, threadName: string): string[] {
    if (this.state.readCount === 0) {
      return [];
    }

    this.state.readCount--;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_release',
      { lockName: this.state.name, lockType: 'read', readCount: this.state.readCount },
      0,
      this.state.name
    );

    const awakenedThreads: string[] = [];

    if (this.state.readCount === 0) {
      this.state.isLocked = false;
      
      const waitingWriter = this.writeWaitQueue.removeFirst();
      if (waitingWriter) {
        const waitTime = this.writeWaitQueue.getWaitTime(waitingWriter, this.time.now);
        this.timeline.addEvent(
          waitingWriter,
          `Thread-${waitingWriter}`,
          'wait_end',
          { lockName: this.state.name, waitTime, lockType: 'write' },
          waitTime,
          this.state.name
        );
        awakenedThreads.push(waitingWriter);
      }
    }

    while (this.state.readCount === 0 && !this.state.isLocked) {
      const waitingReader = this.readWaitQueue.removeFirst();
      if (waitingReader) {
        const waitTime = this.readWaitQueue.getWaitTime(waitingReader, this.time.now);
        this.timeline.addEvent(
          waitingReader,
          `Thread-${waitingReader}`,
          'wait_end',
          { lockName: this.state.name, waitTime, lockType: 'read' },
          waitTime,
          this.state.name
        );
        awakenedThreads.push(waitingReader);
      } else {
        break;
      }
    }

    this.scheduler.updateLockState(this.state.name, {
      ...this.state,
      waitingThreads: [...this.readWaitQueue.getThreads(), ...this.writeWaitQueue.getThreads()],
    });

    return awakenedThreads;
  }

  writeUnlock(threadId: string, threadName: string): string[] {
    if (!this.state.isLocked || this.ownerThreadId !== threadId) {
      return [];
    }

    this.state.isLocked = false;
    this.ownerThreadId = undefined;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_release',
      { lockName: this.state.name, lockType: 'write' },
      0,
      this.state.name
    );

    const awakenedThreads: string[] = [];

    const waitingWriter = this.writeWaitQueue.removeFirst();
    if (waitingWriter) {
      const waitTime = this.writeWaitQueue.getWaitTime(waitingWriter, this.time.now);
      this.timeline.addEvent(
        waitingWriter,
        `Thread-${waitingWriter}`,
        'wait_end',
        { lockName: this.state.name, waitTime, lockType: 'write' },
        waitTime,
        this.state.name
      );
      awakenedThreads.push(waitingWriter);
    } else {
      while (true) {
        const waitingReader = this.readWaitQueue.removeFirst();
        if (waitingReader) {
          const waitTime = this.readWaitQueue.getWaitTime(waitingReader, this.time.now);
          this.timeline.addEvent(
            waitingReader,
            `Thread-${waitingReader}`,
            'wait_end',
            { lockName: this.state.name, waitTime, lockType: 'read' },
            waitTime,
            this.state.name
          );
          awakenedThreads.push(waitingReader);
        } else {
          break;
        }
      }
    }

    this.scheduler.updateLockState(this.state.name, {
      ...this.state,
      ownerThreadId: this.ownerThreadId,
      waitingThreads: [...this.readWaitQueue.getThreads(), ...this.writeWaitQueue.getThreads()],
    });

    return awakenedThreads;
  }

  getState(): LockState {
    return {
      ...this.state,
      ownerThreadId: this.ownerThreadId,
      waitingThreads: [...this.readWaitQueue.getThreads(), ...this.writeWaitQueue.getThreads()],
    };
  }

  getReadCount(): number {
    return this.state.readCount;
  }

  getWriteCount(): number {
    return this.state.writeCount;
  }

  isWriteLocked(): boolean {
    return this.state.isLocked && this.ownerThreadId !== undefined;
  }

  reset(): void {
    this.state = {
      type: 'rwlock',
      name: this.state.name,
      isLocked: false,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.ownerThreadId = undefined;
    this.readWaitQueue.clear();
    this.writeWaitQueue.clear();
    this.scheduler.registerLock(this.state);
  }
}

export class MockSpinLock {
  private state: LockState;
  private time: MockTime;
  private timeline: EventTimeline;
  private scheduler: MockThreadScheduler;
  private maxSpinIterations: number;
  private ownerThreadId?: string;

  constructor(
    name: string,
    time: MockTime,
    timeline: EventTimeline,
    scheduler: MockThreadScheduler,
    maxSpinIterations: number = 100
  ) {
    this.state = {
      type: 'spinlock',
      name,
      isLocked: false,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.time = time;
    this.timeline = timeline;
    this.scheduler = scheduler;
    this.maxSpinIterations = maxSpinIterations;
    
    this.scheduler.registerLock(this.state);
  }

  lock(threadId: string, threadName: string): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_attempt',
      { lockName: this.state.name, lockType: 'spinlock' },
      0,
      this.state.name
    );

    let spinIterations = 0;
    let acquired = false;

    while (spinIterations < this.maxSpinIterations) {
      if (!this.state.isLocked) {
        this.state.isLocked = true;
        this.ownerThreadId = threadId;
        this.state.writeCount++;
        acquired = true;
        break;
      }
      spinIterations++;
      this.state.spinCount++;
      
      this.scheduler.spin(threadId, threadName, 1);
    }

    if (acquired) {
      this.timeline.addEvent(
        threadId,
        threadName,
        'lock_acquire_success',
        { lockName: this.state.name, spinIterations, lockType: 'spinlock' },
        spinIterations * 0.1,
        this.state.name
      );
      this.scheduler.updateLockState(this.state.name, { ...this.state, ownerThreadId: this.ownerThreadId });
    } else {
      this.timeline.addEvent(
        threadId,
        threadName,
        'lock_acquire_failed',
        { lockName: this.state.name, spinIterations, lockType: 'spinlock', reason: 'spin timeout' },
        spinIterations * 0.1,
        this.state.name
      );
      this.scheduler.updateLockState(this.state.name, this.state);
    }

    return acquired;
  }

  tryLock(threadId: string, threadName: string): boolean {
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_attempt',
      { lockName: this.state.name, lockType: 'spinlock', mode: 'try' },
      0,
      this.state.name
    );

    if (!this.state.isLocked) {
      this.state.isLocked = true;
      this.ownerThreadId = threadId;
      this.state.writeCount++;

      this.timeline.addEvent(
        threadId,
        threadName,
        'lock_acquire_success',
        { lockName: this.state.name, lockType: 'spinlock', mode: 'try' },
        0,
        this.state.name
      );
      this.scheduler.updateLockState(this.state.name, { ...this.state, ownerThreadId: this.ownerThreadId });
      return true;
    }

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_failed',
      { lockName: this.state.name, lockType: 'spinlock', mode: 'try' },
      0,
      this.state.name
    );
    return false;
  }

  unlock(threadId: string, threadName: string): boolean {
    if (!this.state.isLocked || this.ownerThreadId !== threadId) {
      this.timeline.addEvent(
        threadId,
        threadName,
        'lock_acquire_failed',
        { lockName: this.state.name, reason: 'not owner' },
        0,
        this.state.name
      );
      return false;
    }

    this.state.isLocked = false;
    this.ownerThreadId = undefined;

    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_release',
      { lockName: this.state.name, lockType: 'spinlock' },
      0,
      this.state.name
    );

    this.scheduler.updateLockState(this.state.name, { ...this.state, ownerThreadId: undefined });
    return true;
  }

  isLocked(): boolean {
    return this.state.isLocked;
  }

  getOwner(): string | undefined {
    return this.ownerThreadId;
  }

  getState(): LockState {
    return { ...this.state, ownerThreadId: this.ownerThreadId };
  }

  getTotalSpinCount(): number {
    return this.state.spinCount;
  }

  reset(): void {
    this.state = {
      type: 'spinlock',
      name: this.state.name,
      isLocked: false,
      readCount: 0,
      writeCount: 0,
      waitingThreads: [],
      spinCount: 0,
    };
    this.ownerThreadId = undefined;
    this.scheduler.registerLock(this.state);
  }
}
