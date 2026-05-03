import { v4 as uuidv4 } from 'uuid';
import { Violation, MqttMessage, ReplayEvent, PendingMessage } from '../types';

export interface DuplicateCommandOptions {
  windowMs?: number;
  ignoreQos0?: boolean;
  checkPayloadContent?: boolean;
}

export class DuplicateCommandRule {
  private violations: Violation[] = [];
  private messageHistory: Map<string, Array<{ id: string; timestamp: number; payload: string; topic: string }>> = new Map();
  private options: Required<DuplicateCommandOptions>;

  constructor(options?: DuplicateCommandOptions) {
    this.options = {
      windowMs: options?.windowMs ?? 5000,
      ignoreQos0: options?.ignoreQos0 ?? true,
      checkPayloadContent: options?.checkPayloadContent ?? true
    };
  }

  check(message: MqttMessage, pendingMessages: PendingMessage[] = []): Violation | null {
    if (this.options.ignoreQos0 && message.qos === 0) {
      return null;
    }

    const clientId = message.clientId;
    const topic = message.topic;
    const payload = message.payload;

    let history = this.messageHistory.get(clientId);
    if (!history) {
      history = [];
      this.messageHistory.set(clientId, history);
    }

    const windowStart = message.timestamp - this.options.windowMs;
    const recentMessages = history.filter(m => m.timestamp >= windowStart);

    const duplicates = recentMessages.filter(m => {
      if (m.topic !== topic) {
        return false;
      }
      
      if (this.options.checkPayloadContent) {
        return m.payload === payload;
      }
      
      return true;
    });

    if (duplicates.length > 0) {
      const violation: Violation = {
        id: uuidv4(),
        type: 'duplicate_command',
        severity: message.dup ? 'warning' : 'info',
        timestamp: message.timestamp,
        deviceId: clientId,
        message: `检测到重复命令：主题 "${topic}" 在 ${this.options.windowMs}ms 内被发送 ${duplicates.length + 1} 次`,
        details: {
          expected: 1,
          actual: duplicates.length + 1,
          relatedMessages: [message.id, ...duplicates.map(d => d.id)],
          context: {
            topic,
            qos: message.qos,
            dup: message.dup,
            windowMs: this.options.windowMs,
            pendingMessageCount: pendingMessages.length,
            firstOccurrence: duplicates[0]?.timestamp,
            payloadHash: this.hashPayload(payload)
          }
        },
        status: 'open'
      };

      this.violations.push(violation);
      return violation;
    }

    history.push({
      id: message.id,
      timestamp: message.timestamp,
      payload,
      topic
    });

    const maxHistory = 1000;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }

    return null;
  }

  checkFromEvents(events: ReplayEvent[]): Violation[] {
    const newViolations: Violation[] = [];

    for (const event of events) {
      if (event.details.type === 'duplicate_message') {
        const violation: Violation = {
          id: uuidv4(),
          type: 'duplicate_command',
          severity: 'warning',
          timestamp: event.timestamp,
          deviceId: event.clientId,
          message: `QoS 重传检测到重复消息，QoS 级别: ${event.details.qos}，待确认消息数: ${event.details.pendingCount}`,
          details: {
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

  private hashPayload(payload: string): string {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getViolations(): Violation[] {
    return [...this.violations];
  }

  getViolationsByClient(clientId: string): Violation[] {
    return this.violations.filter(v => v.deviceId === clientId);
  }

  getSummary(): {
    total: number;
    bySeverity: Record<string, number>;
    byClient: Record<string, number>;
    averageWindowDuplicates: number;
  } {
    const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const byClient: Record<string, number> = {};
    let totalDuplicates = 0;
    let duplicateCount = 0;

    for (const violation of this.violations) {
      bySeverity[violation.severity]++;
      
      if (violation.deviceId) {
        byClient[violation.deviceId] = (byClient[violation.deviceId] || 0) + 1;
      }

      if (typeof violation.details.actual === 'number') {
        totalDuplicates += violation.details.actual;
        duplicateCount++;
      }
    }

    return {
      total: this.violations.length,
      bySeverity,
      byClient,
      averageWindowDuplicates: duplicateCount > 0 ? totalDuplicates / duplicateCount : 0
    };
  }

  reset(): void {
    this.violations = [];
    this.messageHistory.clear();
  }
}
