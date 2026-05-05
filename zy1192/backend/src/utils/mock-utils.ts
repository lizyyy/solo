import { TimelineEvent, LockState } from '../types';

export class MockTime {
  private currentTime: number = 0;
  private eventIdCounter: number = 0;

  constructor(startTime: number = 0) {
    this.currentTime = startTime;
  }

  get now(): number {
    return this.currentTime;
  }

  advance(amount: number): number {
    this.currentTime += amount;
    return this.currentTime;
  }

  generateEventId(): string {
    return `event-${++this.eventIdCounter}`;
  }

  reset(): void {
    this.currentTime = 0;
    this.eventIdCounter = 0;
  }
}

export class EventTimeline {
  private events: TimelineEvent[] = [];
  private time: MockTime;

  constructor(time: MockTime) {
    this.time = time;
  }

  addEvent(
    threadId: string,
    threadName: string,
    eventType: TimelineEvent['eventType'],
    details: Record<string, unknown>,
    cost: number = 0,
    lockName?: string
  ): TimelineEvent {
    const event: TimelineEvent = {
      id: this.time.generateEventId(),
      timestamp: this.time.now,
      threadId,
      threadName,
      eventType,
      details,
      lockName,
      cost,
    };
    this.events.push(event);
    return event;
  }

  addEventAtTime(
    timestamp: number,
    threadId: string,
    threadName: string,
    eventType: TimelineEvent['eventType'],
    details: Record<string, unknown>,
    cost: number = 0,
    lockName?: string
  ): TimelineEvent {
    const event: TimelineEvent = {
      id: this.time.generateEventId(),
      timestamp,
      threadId,
      threadName,
      eventType,
      details,
      lockName,
      cost,
    };
    this.events.push(event);
    return event;
  }

  getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  getEventsByThread(threadId: string): TimelineEvent[] {
    return this.events.filter((e) => e.threadId === threadId);
  }

  getEventsByType(eventType: TimelineEvent['eventType']): TimelineEvent[] {
    return this.events.filter((e) => e.eventType === eventType);
  }

  getEventsByLock(lockName: string): TimelineEvent[] {
    return this.events.filter((e) => e.lockName === lockName);
  }

  getEventsInRange(start: number, end: number): TimelineEvent[] {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  sortByTime(): void {
    this.events.sort((a, b) => a.timestamp - b.timestamp);
  }

  clear(): void {
    this.events = [];
  }
}

export class WaitQueue {
  private queue: Map<string, { threadId: string; waitStartTime: number }> = new Map();

  add(threadId: string, startTime: number): void {
    this.queue.set(threadId, { threadId, waitStartTime: startTime });
  }

  remove(threadId: string): void {
    this.queue.delete(threadId);
  }

  removeFirst(): string | null {
    const entries = Array.from(this.queue.values());
    if (entries.length === 0) return null;
    
    const first = entries.sort((a, b) => a.waitStartTime - b.waitStartTime)[0];
    this.queue.delete(first.threadId);
    return first.threadId;
  }

  has(threadId: string): boolean {
    return this.queue.has(threadId);
  }

  getWaitTime(threadId: string, currentTime: number): number {
    const entry = this.queue.get(threadId);
    if (!entry) return 0;
    return currentTime - entry.waitStartTime;
  }

  size(): number {
    return this.queue.size;
  }

  getThreads(): string[] {
    return Array.from(this.queue.keys());
  }

  clear(): void {
    this.queue.clear();
  }
}

export class MockThreadScheduler {
  private time: MockTime;
  private timeline: EventTimeline;
  private currentThreadId: string | null = null;
  private threadStates: Map<string, 'idle' | 'running' | 'waiting' | 'blocked' | 'finished'> = new Map();
  private lockStates: Map<string, LockState> = new Map();

  constructor(time: MockTime, timeline: EventTimeline) {
    this.time = time;
    this.timeline = timeline;
  }

  registerThread(threadId: string, _threadName: string): void {
    this.threadStates.set(threadId, 'idle');
  }

  registerLock(lock: LockState): void {
    this.lockStates.set(lock.name, lock);
  }

  getThreadState(threadId: string): 'idle' | 'running' | 'waiting' | 'blocked' | 'finished' | undefined {
    return this.threadStates.get(threadId);
  }

  setThreadState(threadId: string, state: 'idle' | 'running' | 'waiting' | 'blocked' | 'finished'): void {
    this.threadStates.set(threadId, state);
  }

  getLockState(lockName: string): LockState | undefined {
    return this.lockStates.get(lockName);
  }

  updateLockState(lockName: string, updates: Partial<LockState>): void {
    const lock = this.lockStates.get(lockName);
    if (lock) {
      this.lockStates.set(lockName, { ...lock, ...updates });
    }
  }

  getCurrentThread(): string | null {
    return this.currentThreadId;
  }

  setCurrentThread(threadId: string | null): void {
    this.currentThreadId = threadId;
  }

  runThread(threadId: string, threadName: string, duration: number): void {
    this.setThreadState(threadId, 'running');
    this.setCurrentThread(threadId);
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'thread_start',
      { duration },
      0
    );
    
    this.time.advance(duration);
  }

  finishThread(threadId: string, threadName: string): void {
    this.setThreadState(threadId, 'finished');
    this.setCurrentThread(null);
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'thread_end',
      {},
      0
    );
  }

  contextSwitch(fromThreadId: string, fromThreadName: string, toThreadId: string, toThreadName: string): void {
    this.setThreadState(fromThreadId, 'idle');
    
    this.timeline.addEvent(
      fromThreadId,
      fromThreadName,
      'wait_end',
      { contextSwitch: true },
      1
    );
    
    this.setThreadState(toThreadId, 'running');
    this.setCurrentThread(toThreadId);
    
    this.timeline.addEvent(
      toThreadId,
      toThreadName,
      'thread_start',
      { contextSwitch: true },
      1
    );
    
    this.time.advance(1);
  }

  spin(threadId: string, threadName: string, iterations: number): number {
    const spinCost = iterations * 0.1;
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'spin_start',
      { iterations },
      0
    );
    
    this.time.advance(spinCost);
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'spin_end',
      { iterations },
      spinCost
    );
    
    return spinCost;
  }

  wait(threadId: string, threadName: string, duration: number): number {
    this.setThreadState(threadId, 'waiting');
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'wait_start',
      { duration },
      0
    );
    
    this.time.advance(duration);
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'wait_end',
      { duration },
      duration
    );
    
    return duration;
  }

  block(threadId: string, threadName: string, lockName: string): void {
    this.setThreadState(threadId, 'blocked');
    const currentLock = this.getLockState(lockName);
    this.updateLockState(lockName, {
      waitingThreads: [...(currentLock?.waitingThreads || []), threadId],
    });
    
    this.timeline.addEvent(
      threadId,
      threadName,
      'lock_acquire_failed',
      { lockName },
      0,
      lockName
    );
  }

  getLockStates(): Map<string, LockState> {
    return new Map(this.lockStates);
  }

  getThreadStates(): Map<string, 'idle' | 'running' | 'waiting' | 'blocked' | 'finished'> {
    return new Map(this.threadStates);
  }

  reset(): void {
    this.currentThreadId = null;
    this.threadStates.clear();
    this.lockStates.clear();
  }
}
