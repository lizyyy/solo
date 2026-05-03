import { v4 as uuidv4 } from 'uuid';
import { Violation, DeviceShadow, DeviceConfig, MqttMessage } from '../types';

export interface ExpiredShadowOptions {
  maxAgeMs?: number;
  checkOnReconnect?: boolean;
}

export class ExpiredShadowRule {
  private violations: Violation[] = [];
  private shadowTimestamps: Map<string, number> = new Map();
  private options: Required<ExpiredShadowOptions>;

  constructor(options?: ExpiredShadowOptions) {
    this.options = {
      maxAgeMs: options?.maxAgeMs ?? 24 * 60 * 60 * 1000,
      checkOnReconnect: options?.checkOnReconnect ?? true
    };
  }

  check(
    deviceId: string,
    currentTimestamp: number,
    shadow?: DeviceShadow,
    config?: DeviceConfig
  ): Violation | null {
    const lastUpdate = shadow?.timestamp ?? 
                       this.shadowTimestamps.get(deviceId) ??
                       config?.lastSeen ??
                       0;

    if (lastUpdate === 0) {
      return null;
    }

    const age = currentTimestamp - lastUpdate;
    
    if (age > this.options.maxAgeMs) {
      const violation: Violation = {
        id: uuidv4(),
        type: 'expired_shadow',
        severity: age > this.options.maxAgeMs * 2 ? 'critical' : 'warning',
        timestamp: currentTimestamp,
        deviceId,
        message: `设备影子已过期：最后更新于 ${this.formatTime(lastUpdate)}，已过期 ${this.formatDuration(age)}`,
        details: {
          expected: this.options.maxAgeMs,
          actual: age,
          context: {
            lastUpdate,
            currentTimestamp,
            ageMs: age,
            maxAgeMs: this.options.maxAgeMs,
            deviceStatus: config?.status || 'unknown',
            configShadowVersion: config?.shadowVersion,
            currentShadowVersion: shadow?.version
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    return null;
  }

  checkOnConnect(
    deviceId: string,
    connectTime: number,
    retainedShadow?: DeviceShadow,
    config?: DeviceConfig
  ): Violation | null {
    if (!this.options.checkOnReconnect) {
      return null;
    }

    if (!retainedShadow) {
      return null;
    }

    const retainedAge = connectTime - retainedShadow.timestamp;
    
    if (retainedAge > this.options.maxAgeMs) {
      const violation: Violation = {
        id: uuidv4(),
        type: 'expired_shadow',
        severity: 'critical',
        timestamp: connectTime,
        deviceId,
        message: `设备重连时发现过期 retained 影子：版本 ${retainedShadow.version}，已过期 ${this.formatDuration(retainedAge)}，可能覆盖新配置`,
        details: {
          expected: this.options.maxAgeMs,
          actual: retainedAge,
          context: {
            retainedShadowVersion: retainedShadow.version,
            retainedShadowTimestamp: retainedShadow.timestamp,
            connectTime,
            retainedAgeMs: retainedAge,
            risk: '旧 retained 消息可能覆盖重连期间的新配置'
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    return null;
  }

  checkRetainOverride(
    message: MqttMessage,
    existingRetainedMessage?: MqttMessage
  ): Violation | null {
    if (!message.retain || !existingRetainedMessage) {
      return null;
    }

    if (message.timestamp < existingRetainedMessage.timestamp) {
      const violation: Violation = {
        id: uuidv4(),
        type: 'retain_override',
        severity: 'critical',
        timestamp: message.timestamp,
        deviceId: message.clientId,
        message: `旧 retained 消息覆盖新配置：现有消息时间 ${this.formatTime(existingRetainedMessage.timestamp)}，新消息时间 ${this.formatTime(message.timestamp)}`,
        details: {
          expected: existingRetainedMessage.timestamp,
          actual: message.timestamp,
          relatedMessages: [message.id, existingRetainedMessage.id],
          context: {
            topic: message.topic,
            existingTimestamp: existingRetainedMessage.timestamp,
            newTimestamp: message.timestamp,
            timeDifference: existingRetainedMessage.timestamp - message.timestamp,
            existingPayload: existingRetainedMessage.payload.substring(0, 100),
            newPayload: message.payload.substring(0, 100)
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    return null;
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} 天 ${hours % 24} 小时`;
    }
    if (hours > 0) {
      return `${hours} 小时 ${minutes % 60} 分钟`;
    }
    if (minutes > 0) {
      return `${minutes} 分钟 ${seconds % 60} 秒`;
    }
    return `${seconds} 秒`;
  }

  updateShadowTimestamp(deviceId: string, timestamp: number): void {
    this.shadowTimestamps.set(deviceId, timestamp);
  }

  getViolations(): Violation[] {
    return [...this.violations];
  }

  getViolationsByDevice(deviceId: string): Violation[] {
    return this.violations.filter(v => v.deviceId === deviceId);
  }

  getSummary(): {
    total: number;
    bySeverity: Record<string, number>;
    byDevice: Record<string, number>;
    oldestShadow: { deviceId: string; age: number } | null;
  } {
    const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const byDevice: Record<string, number> = {};
    let oldestShadow: { deviceId: string; age: number } | null = null;

    for (const violation of this.violations) {
      bySeverity[violation.severity]++;
      
      if (violation.deviceId) {
        byDevice[violation.deviceId] = (byDevice[violation.deviceId] || 0) + 1;
      }

      if (typeof violation.details.actual === 'number') {
        if (!oldestShadow || violation.details.actual > oldestShadow.age) {
          oldestShadow = {
            deviceId: violation.deviceId || 'unknown',
            age: violation.details.actual
          };
        }
      }
    }

    return {
      total: this.violations.length,
      bySeverity,
      byDevice,
      oldestShadow
    };
  }

  reset(): void {
    this.violations = [];
    this.shadowTimestamps.clear();
  }
}
