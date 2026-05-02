import { PlaybackState, Event, Source, CalibrationResult, SyncIssue } from './types';
import { EventWithOffset, checkSyncAtTime } from './timeline';

export interface PlaybackLogEntry {
  timestamp: number;
  playbackTime: number;
  type: 'sync_check' | 'event' | 'issue';
  message: string;
  details?: Record<string, unknown>;
}

export interface PlaybackControllerConfig {
  speed?: number;
  loop?: boolean;
  syncCheckIntervalMs?: number;
}

export class PlaybackController {
  private state: PlaybackState;
  private config: Required<PlaybackControllerConfig>;
  private eventsWithOffset: EventWithOffset[] = [];
  private sources: Source[] = [];
  private syncIssues: SyncIssue[] = [];
  private logs: PlaybackLogEntry[] = [];
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  
  private onStateChange: ((state: PlaybackState) => void) | null = null;
  private onLogEntry: ((entry: PlaybackLogEntry) => void) | null = null;

  constructor(config: PlaybackControllerConfig = {}) {
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      speed: config.speed || 1.0
    };
    
    this.config = {
      speed: config.speed || 1.0,
      loop: config.loop || false,
      syncCheckIntervalMs: config.syncCheckIntervalMs || 100
    };
  }

  setDataSource(
    events: Event[],
    sources: Source[],
    calibrationResults: CalibrationResult[],
    syncIssues: SyncIssue[] = []
  ): void {
    this.eventsWithOffset = events.map(event => {
      const result = calibrationResults.find(r => r.sourceId === event.sourceId);
      const offset = result?.delayOffset || 0;
      return {
        ...event,
        offsetTimestamp: event.timestamp - offset
      };
    });
    
    this.sources = sources;
    this.syncIssues = syncIssues;

    if (this.eventsWithOffset.length > 0) {
      const timestamps = this.eventsWithOffset.map(e => e.offsetTimestamp);
      this.state.duration = Math.max(...timestamps) - Math.min(...timestamps);
    }
  }

  setStateChangeCallback(callback: (state: PlaybackState) => void): void {
    this.onStateChange = callback;
  }

  setLogEntryCallback(callback: (entry: PlaybackLogEntry) => void): void {
    this.onLogEntry = callback;
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  getLogs(): PlaybackLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  play(): void {
    if (this.state.isPlaying) return;
    
    this.state.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.notifyStateChange();
    this.startAnimationLoop();
    
    this.addLog({
      timestamp: Date.now(),
      playbackTime: this.state.currentTime,
      type: 'event',
      message: '回放开始'
    });
  }

  pause(): void {
    if (!this.state.isPlaying) return;
    
    this.state.isPlaying = false;
    this.stopAnimationLoop();
    this.notifyStateChange();
    
    this.addLog({
      timestamp: Date.now(),
      playbackTime: this.state.currentTime,
      type: 'event',
      message: '回放暂停'
    });
  }

  togglePlayPause(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(this.state.duration, time));
    this.state.currentTime = clampedTime;
    this.notifyStateChange();
    
    this.addLog({
      timestamp: Date.now(),
      playbackTime: this.state.currentTime,
      type: 'event',
      message: `跳转到 ${time.toFixed(1)}ms`
    });
  }

  setSpeed(speed: number): void {
    this.state.speed = Math.max(0.1, Math.min(10, speed));
    this.config.speed = this.state.speed;
    this.notifyStateChange();
  }

  setLoop(loop: boolean): void {
    this.config.loop = loop;
  }

  goToStart(): void {
    this.seek(0);
  }

  goToEnd(): void {
    this.seek(this.state.duration);
  }

  private startAnimationLoop(): void {
    const loop = () => {
      this.update(performance.now());
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private update(now: number): void {
    if (!this.state.isPlaying) return;

    const deltaMs = (now - this.lastUpdateTime) * this.state.speed;
    this.lastUpdateTime = now;

    const newTime = this.state.currentTime + deltaMs;

    if (newTime >= this.state.duration) {
      if (this.config.loop) {
        this.state.currentTime = 0;
        this.addLog({
          timestamp: Date.now(),
          playbackTime: 0,
          type: 'event',
          message: '循环回放'
        });
      } else {
        this.state.currentTime = this.state.duration;
        this.pause();
        this.addLog({
          timestamp: Date.now(),
          playbackTime: this.state.duration,
          type: 'event',
          message: '回放结束'
        });
      }
    } else {
      this.state.currentTime = newTime;
    }

    this.checkSync();
    this.notifyStateChange();
  }

  private checkSync(): void {
    const currentTime = this.state.currentTime;
    const checkResult = checkSyncAtTime(currentTime, this.eventsWithOffset, this.sources);

    if (!checkResult.isInSync && checkResult.sources.length >= 2) {
      const sourceNames = checkResult.sources.map(s => {
        const source = this.sources.find(src => src.id === s.sourceId);
        return source?.name || s.sourceId;
      }).join(', ');

      this.addLog({
        timestamp: Date.now(),
        playbackTime: currentTime,
        type: 'sync_check',
        message: `检测到不同步: 最大偏差 ${checkResult.maxDeviation.toFixed(1)}ms`,
        details: {
          maxDeviation: checkResult.maxDeviation,
          sources: checkResult.sources.map(s => ({
            sourceId: s.sourceId,
            offset: s.offset,
            eventCount: s.eventCount
          }))
        }
      });
    }

    for (const issue of this.syncIssues) {
      if (currentTime >= issue.timeRange[0] && currentTime <= issue.timeRange[1]) {
        const wasLogged = this.logs.some(log => 
          log.type === 'issue' && 
          log.details && 
          (log.details as { issueId?: string }).issueId === issue.id
        );
        
        if (!wasLogged) {
          this.addLog({
            timestamp: Date.now(),
            playbackTime: currentTime,
            type: 'issue',
            message: issue.description,
            details: {
              issueId: issue.id,
              timeRange: issue.timeRange,
              maxDeviation: issue.maxDeviation
            }
          });
        }
      }
    }
  }

  private addLog(entry: PlaybackLogEntry): void {
    this.logs.push(entry);
    if (this.onLogEntry) {
      this.onLogEntry(entry);
    }
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  getSourceDelaysAtCurrentTime(): { sourceId: string; delayMs: number; direction: 'lead' | 'lag' | 'none' }[] {
    const currentTime = this.state.currentTime;
    const result: { sourceId: string; delayMs: number; direction: 'lead' | 'lag' | 'none' }[] = [];

    for (const source of this.sources) {
      const sourceEvents = this.eventsWithOffset.filter(e => 
        e.sourceId === source.id && Math.abs(e.offsetTimestamp - currentTime) < 50
      );

      if (sourceEvents.length > 0) {
        const avgOffset = sourceEvents.reduce((sum, e) => sum + (e.offsetTimestamp - currentTime), 0) / sourceEvents.length;
        
        result.push({
          sourceId: source.id,
          delayMs: avgOffset,
          direction: avgOffset > 1 ? 'lag' : avgOffset < -1 ? 'lead' : 'none'
        });
      }
    }

    return result;
  }

  destroy(): void {
    this.stopAnimationLoop();
    this.onStateChange = null;
    this.onLogEntry = null;
  }
}
