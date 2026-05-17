import { diff } from 'deep-object-diff';
import {
  WebSocketFrame,
  StateSnapshot,
  Anomaly,
  StateDiff,
  ReplayResult,
  ReplayOptions,
} from './types';

export class ReplayEngine {
  private options: ReplayOptions;
  private currentState: Record<string, any>;
  private stateSnapshots: StateSnapshot[] = [];
  private anomalies: Anomaly[] = [];
  private stateDiffs: StateDiff[] = [];

  constructor(options: ReplayOptions = {}) {
    this.options = {
      initialState: {},
      ...options,
    };
    this.currentState = { ...this.options.initialState };
  }

  replay(frames: WebSocketFrame[], inputFile: string = ''): ReplayResult {
    this.reset();
    const validFrames = frames.filter(f => f.isValid);
    const sortedFrames = this.sortFrames(validFrames);

    const startTime = sortedFrames.length > 0 ? sortedFrames[0].timestamp : 0;
    const endTime = sortedFrames.length > 0 ? sortedFrames[sortedFrames.length - 1].timestamp : 0;

    sortedFrames.forEach((frame, index) => {
      this.processFrame(frame, index);
    });

    frames.filter(f => !f.isValid).forEach((frame, index) => {
      this.anomalies.push({
        type: 'parse_error',
        severity: 'low',
        frameIndex: index,
        frame,
        message: frame.parseError || '解析失败',
        details: { lineNumber: frame.lineNumber },
      });
    });

    return {
      meta: {
        inputFile,
        totalLines: frames.length,
        validFrames: validFrames.length,
        invalidFrames: frames.length - validFrames.length,
        startTime,
        endTime,
        durationMs: endTime - startTime,
      },
      frames: sortedFrames,
      stateSnapshots: this.stateSnapshots,
      anomalies: this.anomalies,
      stateDiffs: this.stateDiffs,
      finalState: { ...this.currentState },
    };
  }

  private reset(): void {
    this.currentState = { ...this.options.initialState };
    this.stateSnapshots = [];
    this.anomalies = [];
    this.stateDiffs = [];
  }

  private sortFrames(frames: WebSocketFrame[]): WebSocketFrame[] {
    return [...frames].sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.lineNumber - b.lineNumber;
    });
  }

  private processFrame(frame: WebSocketFrame, index: number): void {
    const previousState = { ...this.currentState };

    this.extractState(frame);
    this.checkAnomalyRules(frame, index);
    this.detectStateChanges(frame, index, previousState);

    this.stateSnapshots.push({
      frameIndex: index,
      timestamp: frame.timestamp,
      state: { ...this.currentState },
      frame,
    });
  }

  private extractState(frame: WebSocketFrame): void {
    if (this.options.stateExtractor) {
      const newState = this.options.stateExtractor(frame, this.currentState);
      this.currentState = { ...this.currentState, ...newState };
      return;
    }

    this.defaultStateExtractor(frame);
  }

  private defaultStateExtractor(frame: WebSocketFrame): void {
    if (!frame.payload) return;

    try {
      const payload = JSON.parse(frame.payload);

      if (typeof payload === 'object' && payload !== null) {
        if (frame.direction === 'in') {
          if (!this.currentState.received) {
            this.currentState.received = [];
          }
          this.currentState.received.push({
            time: frame.timestamp,
            opcode: frame.opcode,
            data: payload,
          });
        } else if (frame.direction === 'out') {
          if (!this.currentState.sent) {
            this.currentState.sent = [];
          }
          this.currentState.sent.push({
            time: frame.timestamp,
            opcode: frame.opcode,
            data: payload,
          });
        }

        if (payload.type === 'state' || payload.type === 'sync') {
          this.currentState = { ...this.currentState, ...payload };
        }

        if (payload.event || payload.action) {
          const key = payload.event || payload.action;
          if (!this.currentState.events) {
            this.currentState.events = {};
          }
          this.currentState.events[key] = (this.currentState.events[key] || 0) + 1;
        }
      }
    } catch {
    }
  }

  private checkAnomalyRules(frame: WebSocketFrame, index: number): void {
    if (!this.options.anomalyRules) return;

    for (const rule of this.options.anomalyRules) {
      if (rule.check(frame, this.currentState, index)) {
        this.anomalies.push({
          type: 'custom',
          severity: rule.severity,
          frameIndex: index,
          frame,
          message: rule.message,
          details: { ruleId: rule.id, ruleName: rule.name },
        });
      }
    }
  }

  private detectStateChanges(frame: WebSocketFrame, index: number, previousState: Record<string, any>): void {
    const changes = diff(previousState, this.currentState) as Record<string, any>;

    this.flattenDiff(changes, '', index, previousState, this.currentState);
  }

  private flattenDiff(
    diffObj: Record<string, any>,
    path: string,
    frameIndex: number,
    oldState: Record<string, any>,
    newState: Record<string, any>
  ): void {
    for (const key of Object.keys(diffObj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = diffObj[key];

      if (value && typeof value === 'object') {
        if (value._t === 'a') {
          this.stateDiffs.push({
            frameIndex,
            path: currentPath,
            oldValue: this.getNestedValue(oldState, currentPath),
            newValue: this.getNestedValue(newState, currentPath),
            operation: 'update',
          });
        } else {
          this.flattenDiff(value, currentPath, frameIndex, oldState, newState);
        }
      } else {
        const oldVal = this.getNestedValue(oldState, currentPath);
        const newVal = this.getNestedValue(newState, currentPath);

        let operation: 'add' | 'remove' | 'update';
        if (oldVal === undefined && newVal !== undefined) {
          operation = 'add';
        } else if (oldVal !== undefined && newVal === undefined) {
          operation = 'remove';
        } else {
          operation = 'update';
        }

        this.stateDiffs.push({
          frameIndex,
          path: currentPath,
          oldValue: oldVal,
          newValue: newVal,
          operation,
        });
      }
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result === undefined || result === null) {
        return undefined;
      }
      result = result[key];
    }

    return result;
  }

  getStateAtFrame(frameIndex: number): Record<string, any> | null {
    const snapshot = this.stateSnapshots.find(s => s.frameIndex === frameIndex);
    return snapshot ? { ...snapshot.state } : null;
  }

  findFrameByTime(timestamp: number): WebSocketFrame | null {
    const snapshot = this.stateSnapshots.find(s => s.timestamp >= timestamp);
    return snapshot ? snapshot.frame : null;
  }
}
