import { v4 as uuidv4 } from 'uuid';
import { Violation, AlertRule, MqttMessage, Session } from '../types';

export interface MissedAlertOptions {
  alertTopics?: string[];
  criticalPatterns?: string[];
}

export class MissedAlertRule {
  private violations: Violation[] = [];
  private alertMessages: Array<{
    id: string;
    timestamp: number;
    topic: string;
    payload: string;
    deviceId: string;
  }> = [];
  private offlinePeriods: Map<string, Array<{ start: number; end: number | null }>> = new Map();
  private options: Required<MissedAlertOptions>;

  constructor(options?: MissedAlertOptions) {
    this.options = {
      alertTopics: options?.alertTopics ?? ['alert/#', 'alarms/#', 'events/+/alert'],
      criticalPatterns: options?.criticalPatterns ?? ['critical', 'emergency', 'error', 'fault']
    };
  }

  check(
    message: MqttMessage,
    session: Session,
    rules: AlertRule[] = []
  ): Violation | null {
    if (!this.isAlertMessage(message)) {
      return null;
    }

    const wasOffline = this.wasOfflineDuringPeriod(
      message.clientId,
      message.timestamp - 60000,
      message.timestamp
    );

    if (wasOffline) {
      const isCritical = this.isCriticalAlert(message);
      
      const violation: Violation = {
        id: uuidv4(),
        type: 'missed_alert',
        severity: isCritical ? 'critical' : 'warning',
        timestamp: message.timestamp,
        deviceId: message.clientId,
        message: `设备离线期间发送的告警：${isCritical ? '关键告警' : '普通告警'}，主题 "${message.topic}"`,
        details: {
          context: {
            topic: message.topic,
            payload: message.payload,
            offlinePeriods: this.getOfflinePeriodsForMessage(message.clientId, message.timestamp),
            isCritical,
            relatedRules: this.findMatchingRules(message, rules)
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    this.alertMessages.push({
      id: message.id,
      timestamp: message.timestamp,
      topic: message.topic,
      payload: message.payload,
      deviceId: message.clientId
    });

    return null;
  }

  checkOfflinePeriod(
    deviceId: string,
    offlineStart: number,
    offlineEnd: number,
    rules: AlertRule[] = []
  ): Violation[] {
    const newViolations: Violation[] = [];

    const alertsDuringOffline = this.alertMessages.filter(a =>
      a.deviceId === deviceId &&
      a.timestamp >= offlineStart &&
      a.timestamp <= offlineEnd
    );

    for (const alert of alertsDuringOffline) {
      const isCritical = this.isCriticalAlert({
        topic: alert.topic,
        payload: alert.payload
      } as MqttMessage);

      const violation: Violation = {
        id: uuidv4(),
        type: 'missed_alert',
        severity: isCritical ? 'critical' : 'warning',
        timestamp: alert.timestamp,
        deviceId,
        message: `离线期间 ${isCritical ? '关键' : ''}告警漏发检测：主题 "${alert.topic}"`,
        details: {
          context: {
            alertId: alert.id,
            topic: alert.topic,
            payload: alert.payload,
            offlineStart,
            offlineEnd,
            offlineDuration: offlineEnd - offlineStart,
            isCritical,
            relatedRules: this.findMatchingRules({ topic: alert.topic } as MqttMessage, rules)
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      newViolations.push(violation);
    }

    return newViolations;
  }

  private isAlertMessage(message: MqttMessage): boolean {
    for (const pattern of this.options.alertTopics) {
      if (this.matchTopic(pattern, message.topic)) {
        return true;
      }
    }
    return false;
  }

  private isCriticalAlert(message: { topic: string; payload: string }): boolean {
    const lowerTopic = message.topic.toLowerCase();
    const lowerPayload = message.payload.toLowerCase();

    for (const pattern of this.options.criticalPatterns) {
      if (lowerTopic.includes(pattern) || lowerPayload.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchTopic(pattern: string, topic: string): boolean {
    if (pattern === '#') {
      return true;
    }

    if (pattern === topic) {
      return true;
    }

    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const topicPart = topicParts[i];

      if (patternPart === '#') {
        return true;
      }

      if (patternPart === '+') {
        if (topicPart === undefined) {
          return false;
        }
        continue;
      }

      if (patternPart !== topicPart) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  private wasOfflineDuringPeriod(deviceId: string, start: number, end: number): boolean {
    const periods = this.offlinePeriods.get(deviceId) || [];

    for (const period of periods) {
      const periodEnd = period.end || Date.now();
      
      if (period.start <= end && periodEnd >= start) {
        return true;
      }
    }

    return false;
  }

  private getOfflinePeriodsForMessage(deviceId: string, timestamp: number): Array<{ start: number; end: number | null }> {
    const periods = this.offlinePeriods.get(deviceId) || [];

    return periods.filter(period => {
      const periodEnd = period.end || Date.now();
      return period.start <= timestamp && periodEnd >= timestamp;
    });
  }

  private findMatchingRules(message: MqttMessage, rules: AlertRule[]): string[] {
    const matchingRules: string[] = [];

    for (const rule of rules) {
      if (this.matchTopic(rule.topicPattern, message.topic)) {
        matchingRules.push(rule.id);
      }
    }

    return matchingRules;
  }

  addOfflinePeriod(deviceId: string, start: number, end: number | null): void {
    if (!this.offlinePeriods.has(deviceId)) {
      this.offlinePeriods.set(deviceId, []);
    }
    this.offlinePeriods.get(deviceId)?.push({ start, end });
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
    criticalAlerts: number;
    totalAlerts: number;
  } {
    const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const byDevice: Record<string, number> = {};
    let criticalAlerts = 0;

    for (const violation of this.violations) {
      bySeverity[violation.severity]++;
      
      if (violation.deviceId) {
        byDevice[violation.deviceId] = (byDevice[violation.deviceId] || 0) + 1;
      }

      if (violation.severity === 'critical') {
        criticalAlerts++;
      }
    }

    return {
      total: this.violations.length,
      bySeverity,
      byDevice,
      criticalAlerts,
      totalAlerts: this.alertMessages.length
    };
  }

  reset(): void {
    this.violations = [];
    this.alertMessages = [];
    this.offlinePeriods.clear();
  }
}
