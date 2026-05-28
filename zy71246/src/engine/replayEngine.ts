import type { EventLog } from '../types/mission';

export class ReplayEngine {
  private events: EventLog[];
  private currentIndex: number;
  private speed: number;
  private onEvent: (event: EventLog, index: number) => void;
  private timer: number | null;
  private isPlaying: boolean;

  constructor(
    events: EventLog[],
    onEvent: (event: EventLog, index: number) => void
  ) {
    this.events = [...events].sort((a, b) => a.timestamp - b.timestamp);
    this.currentIndex = 0;
    this.speed = 1;
    this.onEvent = onEvent;
    this.timer = null;
    this.isPlaying = false;
  }

  play(): void {
    if (this.currentIndex >= this.events.length) return;
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playNext();
  }

  private playNext = (): void => {
    if (!this.isPlaying) return;
    if (this.currentIndex >= this.events.length) {
      this.stop();
      return;
    }

    const event = this.events[this.currentIndex];
    this.onEvent(event, this.currentIndex);
    this.currentIndex++;

    if (this.currentIndex < this.events.length) {
      const nextEvent = this.events[this.currentIndex];
      const delay = Math.max(100, (nextEvent.timestamp - event.timestamp) / this.speed);
      this.timer = window.setTimeout(this.playNext, delay);
    } else {
      this.stop();
    }
  };

  pause(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  stop(): void {
    this.pause();
    this.currentIndex = 0;
  }

  reset(): void {
    this.pause();
    this.currentIndex = 0;
  }

  seekTo(timestamp: number): void {
    this.pause();
    const index = this.events.findIndex(e => e.timestamp >= timestamp);
    this.currentIndex = index >= 0 ? index : this.events.length;
    
    for (let i = 0; i < this.currentIndex; i++) {
      this.onEvent(this.events[i], i);
    }
  }

  seekToIndex(index: number): void {
    this.pause();
    const targetIndex = Math.max(0, Math.min(this.events.length, index));
    
    if (targetIndex < this.currentIndex) {
      this.currentIndex = 0;
      for (let i = 0; i < targetIndex; i++) {
        this.onEvent(this.events[i], i);
      }
    } else {
      for (let i = this.currentIndex; i < targetIndex; i++) {
        this.onEvent(this.events[i], i);
      }
    }
    
    this.currentIndex = targetIndex;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(16, speed));
  }

  getSpeed(): number {
    return this.speed;
  }

  getProgress(): number {
    if (this.events.length === 0) return 0;
    return this.currentIndex / this.events.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalEvents(): number {
    return this.events.length;
  }

  getCurrentTime(): number {
    if (this.currentIndex === 0) {
      return this.events[0]?.timestamp || 0;
    }
    if (this.currentIndex >= this.events.length) {
      return this.events[this.events.length - 1]?.timestamp || 0;
    }
    return this.events[this.currentIndex - 1]?.timestamp || 0;
  }

  getStartTime(): number {
    return this.events[0]?.timestamp || 0;
  }

  getEndTime(): number {
    return this.events[this.events.length - 1]?.timestamp || 0;
  }

  getEventsInRange(startTime: number, endTime: number): EventLog[] {
    return this.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  getKeyEvents(): Array<{ event: EventLog; index: number }> {
    const keyTypes = ['window_missed', 'command_timeout', 'data_packet_lost', 'mission_start', 'mission_end'];
    return this.events
      .map((event, index) => ({ event, index }))
      .filter(item => keyTypes.includes(item.event.type));
  }

  isAtEnd(): boolean {
    return this.currentIndex >= this.events.length;
  }

  isAtStart(): boolean {
    return this.currentIndex === 0;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  stepForward(): void {
    if (this.currentIndex < this.events.length) {
      const event = this.events[this.currentIndex];
      this.onEvent(event, this.currentIndex);
      this.currentIndex++;
    }
  }

  stepBackward(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.seekToIndex(this.currentIndex);
    }
  }

  destroy(): void {
    this.pause();
    this.events = [];
  }
}

export function createReplayEngine(
  events: EventLog[],
  onEvent: (event: EventLog, index: number) => void
): ReplayEngine {
  return new ReplayEngine(events, onEvent);
}

export function getEventTimelineMarkers(
  events: EventLog[],
  startTime: number,
  endTime: number,
  width: number
): Array<{ x: number; type: string; severity: string }> {
  const duration = endTime - startTime;
  if (duration === 0) return [];

  return events.map(event => ({
    x: ((event.timestamp - startTime) / duration) * width,
    type: event.type,
    severity: event.severity,
  }));
}

export function getTimeFromPosition(
  position: number,
  startTime: number,
  endTime: number,
  width: number
): number {
  const duration = endTime - startTime;
  return startTime + (position / width) * duration;
}
