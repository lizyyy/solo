import { v4 as uuidv4 } from 'uuid';
import { Session, PendingMessage, MqttMessage } from '../types';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private offlinePeriods: Map<string, Array<{ start: number; end: number | null }>> = new Map();

  createSession(clientId: string, connectTime: number): Session {
    let session = this.sessions.get(clientId);

    if (!session) {
      session = {
        clientId,
        connected: true,
        connectTime,
        subscriptions: [],
        pendingMessages: []
      };
      this.sessions.set(clientId, session);
    } else {
      if (!session.connected) {
        const offlinePeriods = this.offlinePeriods.get(clientId) || [];
        if (offlinePeriods.length > 0) {
          const lastPeriod = offlinePeriods[offlinePeriods.length - 1];
          if (lastPeriod.end === null) {
            lastPeriod.end = connectTime;
          }
        }
      }

      session.connected = true;
      session.connectTime = connectTime;
    }

    return { ...session };
  }

  disconnectSession(clientId: string, disconnectTime: number): Session | undefined {
    const session = this.sessions.get(clientId);
    if (!session) {
      return undefined;
    }

    session.connected = false;
    session.disconnectTime = disconnectTime;

    const offlinePeriods = this.offlinePeriods.get(clientId) || [];
    offlinePeriods.push({ start: disconnectTime, end: null });
    this.offlinePeriods.set(clientId, offlinePeriods);

    return { ...session };
  }

  getSession(clientId: string): Session | undefined {
    const session = this.sessions.get(clientId);
    return session ? { ...session } : undefined;
  }

  addSubscription(clientId: string, topic: string): boolean {
    const session = this.sessions.get(clientId);
    if (!session || !session.connected) {
      return false;
    }

    if (!session.subscriptions.includes(topic)) {
      session.subscriptions.push(topic);
    }

    return true;
  }

  removeSubscription(clientId: string, topic: string): boolean {
    const session = this.sessions.get(clientId);
    if (!session) {
      return false;
    }

    const index = session.subscriptions.indexOf(topic);
    if (index !== -1) {
      session.subscriptions.splice(index, 1);
      return true;
    }

    return false;
  }

  isSubscribed(clientId: string, topic: string): boolean {
    const session = this.sessions.get(clientId);
    if (!session) {
      return false;
    }

    return session.subscriptions.some(sub => this.matchTopic(sub, topic));
  }

  private matchTopic(subscription: string, topic: string): boolean {
    if (subscription === '#') {
      return true;
    }

    if (subscription === topic) {
      return true;
    }

    const subParts = subscription.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < subParts.length; i++) {
      const subPart = subParts[i];
      const topicPart = topicParts[i];

      if (subPart === '#') {
        return true;
      }

      if (subPart === '+') {
        if (topicPart === undefined) {
          return false;
        }
        continue;
      }

      if (subPart !== topicPart) {
        return false;
      }
    }

    return subParts.length === topicParts.length;
  }

  addPendingMessage(message: MqttMessage, qos: 0 | 1 | 2): PendingMessage | null {
    const session = this.sessions.get(message.clientId);
    if (!session) {
      return null;
    }

    if (qos === 0) {
      return null;
    }

    const pendingMessage: PendingMessage = {
      messageId: uuidv4(),
      message,
      qos,
      state: 'pending',
      retries: 0,
      lastSent: message.timestamp
    };

    session.pendingMessages.push(pendingMessage);

    return { ...pendingMessage };
  }

  updatePendingMessageState(
    clientId: string,
    messageId: string,
    state: PendingMessage['state']
  ): boolean {
    const session = this.sessions.get(clientId);
    if (!session) {
      return false;
    }

    const pendingIndex = session.pendingMessages.findIndex(p => p.messageId === messageId);
    if (pendingIndex === -1) {
      return false;
    }

    session.pendingMessages[pendingIndex].state = state;

    if (state === 'complete') {
      session.pendingMessages.splice(pendingIndex, 1);
    }

    return true;
  }

  getPendingMessages(clientId: string): PendingMessage[] {
    const session = this.sessions.get(clientId);
    if (!session) {
      return [];
    }

    return [...session.pendingMessages];
  }

  getOfflinePeriods(clientId: string): Array<{ start: number; end: number | null }> {
    return [...(this.offlinePeriods.get(clientId) || [])];
  }

  isOfflineDuringPeriod(
    clientId: string,
    startTime: number,
    endTime: number
  ): {
    isOffline: boolean;
    offlinePeriods: Array<{ start: number; end: number | null }>;
  } {
    const periods = this.getOfflinePeriods(clientId);
    const relevantPeriods: Array<{ start: number; end: number | null }> = [];

    for (const period of periods) {
      const periodEnd = period.end || Date.now();
      
      if (period.start <= endTime && periodEnd >= startTime) {
        relevantPeriods.push(period);
      }
    }

    return {
      isOffline: relevantPeriods.length > 0,
      offlinePeriods: relevantPeriods
    };
  }

  getAllSessions(): Map<string, Session> {
    const result = new Map<string, Session>();
    for (const [key, value] of this.sessions) {
      result.set(key, { ...value, pendingMessages: [...value.pendingMessages] });
    }
    return result;
  }

  checkDuplicateMessage(
    clientId: string,
    message: MqttMessage,
    windowMs: number = 5000
  ): {
    isDuplicate: boolean;
    previousMessage?: MqttMessage;
    pendingMessages: PendingMessage[];
  } {
    const session = this.sessions.get(clientId);
    if (!session) {
      return {
        isDuplicate: false,
        pendingMessages: []
      };
    }

    const similarPending = session.pendingMessages.filter(p => {
      const sameTopic = p.message.topic === message.topic;
      const samePayload = p.message.payload === message.payload;
      const withinWindow = message.timestamp - p.lastSent < windowMs;
      return sameTopic && samePayload && withinWindow;
    });

    if (similarPending.length > 0) {
      return {
        isDuplicate: true,
        previousMessage: similarPending[0].message,
        pendingMessages: [...similarPending]
      };
    }

    return {
      isDuplicate: false,
      pendingMessages: []
    };
  }
}
