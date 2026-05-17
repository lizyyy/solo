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
  private previousState: Record<string, any> = {};
  private stateSnapshots: StateSnapshot[] = [];
  private anomalies: Anomaly[] = [];
  private stateDiffs: StateDiff[] = [];

  constructor(options: ReplayOptions = {}) {
    this.options = {
      initialState: {},
      enableBuiltinRules: true,
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
    this.previousState = previousState;

    this.extractState(frame);
    
    if (this.options.enableBuiltinRules) {
      this.detectBuiltinAnomalies(frame, index, previousState);
    }
    
    this.checkAnomalyRules(frame, index);
    this.detectStateChanges(frame, index, previousState);

    this.stateSnapshots.push({
      frameIndex: index,
      timestamp: frame.timestamp,
      state: { ...this.currentState },
      frame,
    });
  }

  private detectBuiltinAnomalies(frame: WebSocketFrame, index: number, previousState: Record<string, any>): void {
    this.detectErrorMessage(frame, index);
    this.detectDisconnectMessage(frame, index);
    this.detectStateSpikes(frame, index, previousState);
    this.detectUnexpectedValues(frame, index);
  }

  private detectErrorMessage(frame: WebSocketFrame, index: number): void {
    try {
      const payload = JSON.parse(frame.payload);
      if (payload.error || payload.type === 'error' || 
          (payload.data && payload.data.error) ||
          payload.status === 'error') {
        this.anomalies.push({
          type: 'error_message',
          severity: 'high',
          frameIndex: index,
          frame,
          message: `检测到错误消息: ${payload.error || payload.message || '未知错误'}`,
          details: { payload },
        });
      }
    } catch {}
  }

  private detectDisconnectMessage(frame: WebSocketFrame, index: number): void {
    try {
      const payload = JSON.parse(frame.payload);
      if (payload.type === 'disconnect' || payload.reason) {
        const isCorrupted = payload.reason?.includes('corrupted') || 
                           payload.reason?.includes('invalid') ||
                           payload.reason?.includes('error');
        this.anomalies.push({
          type: 'disconnect',
          severity: isCorrupted ? 'critical' : 'medium',
          frameIndex: index,
          frame,
          message: `连接断开: ${payload.reason || '未知原因'}`,
          details: { payload, reason: payload.reason },
        });
      }
    } catch {}
  }

  private detectStateSpikes(frame: WebSocketFrame, index: number, previousState: Record<string, any>): void {
    const numericPaths = this.findNumericPaths(this.currentState);
    
    for (const path of numericPaths) {
      const oldVal = this.getNestedValue(previousState, path);
      const newVal = this.getNestedValue(this.currentState, path);
      
      if (oldVal === undefined || typeof oldVal !== 'number' || 
          newVal === undefined || typeof newVal !== 'number') {
        continue;
      }

      if (oldVal === 0) continue;
      
      const changePercent = Math.abs((newVal - oldVal) / oldVal) * 100;
      const changeAmount = Math.abs(newVal - oldVal);
      
      let severity: 'low' | 'medium' | 'high' | 'critical' | null = null;
      let message = '';
      
      if (changePercent >= 500 || changeAmount >= 500) {
        severity = 'critical';
        message = `${path} 发生极度异常跳变: ${oldVal} → ${newVal} (变化${changePercent.toFixed(0)}%)`;
      } else if (changePercent >= 200 || changeAmount >= 200) {
        severity = 'high';
        message = `${path} 发生大幅跳变: ${oldVal} → ${newVal} (变化${changePercent.toFixed(0)}%)`;
      } else if (changePercent >= 50 || changeAmount >= 50) {
        severity = 'medium';
        message = `${path} 发生明显跳变: ${oldVal} → ${newVal} (变化${changePercent.toFixed(0)}%)`;
      }
      
      if (severity && oldVal !== newVal) {
        this.anomalies.push({
          type: 'state_spike',
          severity,
          frameIndex: index,
          frame,
          message,
          details: { path, oldValue: oldVal, newValue: newVal, changePercent },
        });
      }
    }
  }

  private detectUnexpectedValues(frame: WebSocketFrame, index: number): void {
    const suspiciousPatterns = [
      { value: 999, name: '可疑的最大值(999)' },
      { value: 0, name: '零值', minCount: 3 },
      { value: -1, name: '异常负值' },
    ];
    
    for (const pattern of suspiciousPatterns) {
      const paths = this.findPathsWithValue(this.currentState, pattern.value);
      if (paths.length > 0) {
        const isExtreme = pattern.value === 999 || pattern.value === -1;
        if (isExtreme || (pattern.minCount && paths.length >= pattern.minCount)) {
          this.anomalies.push({
            type: 'unexpected_value',
            severity: isExtreme ? 'high' : 'medium',
            frameIndex: index,
            frame,
            message: `检测到${pattern.name}: ${paths.join(', ')}`,
            details: { paths, value: pattern.value },
          });
        }
      }
    }

    if (this.currentState.bugs || this.currentState.corrupted) {
      this.anomalies.push({
        type: 'state_corruption',
        severity: 'critical',
        frameIndex: index,
        frame,
        message: '检测到状态损坏标记',
        details: { flags: { bugs: this.currentState.bugs, corrupted: this.currentState.corrupted } },
      });
    }
  }

  private findNumericPaths(obj: Record<string, any>, prefix: string = ''): string[] {
    const paths: string[] = [];
    
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'number') {
        paths.push(path);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.findNumericPaths(value, path));
      }
    }
    
    return paths;
  }

  private findPathsWithValue(obj: Record<string, any>, targetValue: number, prefix: string = ''): string[] {
    const paths: string[] = [];
    
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value === targetValue) {
        paths.push(path);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.findPathsWithValue(value, targetValue, path));
      }
    }
    
    return paths;
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
