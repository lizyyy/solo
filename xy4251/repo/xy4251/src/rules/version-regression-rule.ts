import { v4 as uuidv4 } from 'uuid';
import { Violation, MqttMessage, DeviceShadow, ReplayEvent } from '../types';

export class VersionRegressionRule {
  private violations: Violation[] = [];
  private versionHistory: Map<string, Array<{ version: number; timestamp: number; messageId: string }>> = new Map();

  check(message: MqttMessage, currentShadow?: DeviceShadow): Violation | null {
    const shadowInfo = this.parseShadowMessage(message);
    
    if (!shadowInfo || shadowInfo.version === undefined) {
      return null;
    }

    const deviceId = shadowInfo.deviceId;
    const incomingVersion = shadowInfo.version;

    let history = this.versionHistory.get(deviceId);
    if (!history) {
      history = [];
      this.versionHistory.set(deviceId, history);
    }

    if (currentShadow && incomingVersion < currentShadow.version) {
      const violation: Violation = {
        id: uuidv4(),
        type: 'version_regression',
        severity: 'critical',
        timestamp: message.timestamp,
        deviceId,
        message: `设备影子版本倒退：当前版本 ${currentShadow.version}，接收版本 ${incomingVersion}`,
        details: {
          expected: currentShadow.version,
          actual: incomingVersion,
          relatedMessages: [message.id, ...history.slice(-5).map(h => h.messageId)],
          context: {
            currentShadowVersion: currentShadow.version,
            incomingVersion,
            history: [...history, { version: incomingVersion, timestamp: message.timestamp, messageId: message.id }]
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    history.push({
      version: incomingVersion,
      timestamp: message.timestamp,
      messageId: message.id
    });

    return null;
  }

  checkFromEvents(events: ReplayEvent[]): Violation[] {
    const newViolations: Violation[] = [];

    for (const event of events) {
      if (event.details.type === 'version_regression') {
        const violation: Violation = {
          id: uuidv4(),
          type: 'version_regression',
          severity: 'critical',
          timestamp: event.timestamp,
          deviceId: event.details.deviceId as string,
          message: `设备影子版本倒退检测：当前版本 ${event.details.currentVersion}，接收版本 ${event.details.incomingVersion}`,
          details: {
            expected: event.details.currentVersion,
            actual: event.details.incomingVersion,
            context: event.details
          },
          status: 'open'
        };

        this.violations.push(violation);
        newViolations.push(violation);
      }
    }

    return newViolations;
  }

  private parseShadowMessage(message: MqttMessage): {
    deviceId: string;
    operation: string;
    version?: number;
  } | null {
    try {
      const topicParts = message.topic.split('/');
      
      let deviceId: string;
      let operation: string;

      if (topicParts[0] === '$aws' && topicParts[1] === 'things') {
        deviceId = topicParts[2];
        operation = topicParts[3] || 'update';
      } else if (topicParts[0] === 'shadow') {
        deviceId = topicParts[1];
        operation = topicParts[2] || 'update';
      } else {
        deviceId = message.clientId;
        operation = 'update';
      }

      let payload: Record<string, unknown> = {};
      if (message.payload) {
        try {
          payload = JSON.parse(message.payload);
        } catch {
          return null;
        }
      }

      const version = typeof payload.version === 'number' ? payload.version : undefined;

      return { deviceId, operation, version };
    } catch {
      return null;
    }
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
  } {
    const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const byDevice: Record<string, number> = {};

    for (const violation of this.violations) {
      bySeverity[violation.severity]++;
      
      if (violation.deviceId) {
        byDevice[violation.deviceId] = (byDevice[violation.deviceId] || 0) + 1;
      }
    }

    return {
      total: this.violations.length,
      bySeverity,
      byDevice
    };
  }

  reset(): void {
    this.violations = [];
    this.versionHistory.clear();
  }
}
