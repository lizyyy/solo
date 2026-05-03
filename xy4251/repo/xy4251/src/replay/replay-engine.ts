import { v4 as uuidv4 } from 'uuid';
import {
  MqttMessage,
  ReplayEvent,
  ReplayResult,
  Session,
  DeviceShadow
} from '../types';
import { Timeline } from './timeline';
import { SessionManager } from '../model/session-manager';
import { DeviceShadowManager } from '../model/device-shadow';

export interface ReplayOptions {
  speed?: number;
  startTime?: number;
  endTime?: number;
  simulateDisconnects?: boolean;
  processRetainedMessages?: boolean;
  handleQoS?: boolean;
}

export class ReplayEngine {
  private timeline: Timeline;
  private sessionManager: SessionManager;
  private shadowManager: DeviceShadowManager;
  private retainedMessages: Map<string, MqttMessage> = new Map();
  private options: Required<ReplayOptions>;

  constructor(
    messages?: MqttMessage[],
    options?: ReplayOptions
  ) {
    this.timeline = new Timeline(messages);
    this.sessionManager = new SessionManager();
    this.shadowManager = new DeviceShadowManager();
    this.options = {
      speed: options?.speed ?? 1,
      startTime: options?.startTime ?? 0,
      endTime: options?.endTime ?? Infinity,
      simulateDisconnects: options?.simulateDisconnects ?? true,
      processRetainedMessages: options?.processRetainedMessages ?? true,
      handleQoS: options?.handleQoS ?? true
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.timeline.on('connect', (event) => {
      this.sessionManager.createSession(event.clientId, event.timestamp);
    });

    this.timeline.on('disconnect', (event) => {
      this.sessionManager.disconnectSession(event.clientId, event.timestamp);
    });

    this.timeline.on('subscribe', (event) => {
      const topic = event.details.topic as string;
      if (topic) {
        this.sessionManager.addSubscription(event.clientId, topic);
        
        if (this.options.processRetainedMessages) {
          this.deliverRetainedMessagesToSubscriber(event.clientId, topic);
        }
      }
    });

    this.timeline.on('unsubscribe', (event) => {
      const topic = event.details.topic as string;
      if (topic) {
        this.sessionManager.removeSubscription(event.clientId, topic);
      }
    });
  }

  private deliverRetainedMessagesToSubscriber(clientId: string, subscriptionTopic: string): void {
    for (const [topic, message] of this.retainedMessages) {
      if (this.matchesSubscription(subscriptionTopic, topic)) {
        this.timeline.addEvent({
          timestamp: Date.now(),
          type: 'message',
          clientId,
          details: {
            source: 'retained',
            topic,
            payload: message.payload,
            qos: message.qos
          },
          originalMessage: message
        });
      }
    }
  }

  private matchesSubscription(subscription: string, topic: string): boolean {
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

  async replay(): Promise<ReplayResult> {
    const messages = this.timeline.getMessages();
    
    if (messages.length === 0) {
      return this.getResult();
    }

    const filteredMessages = messages.filter(m => 
      m.timestamp >= this.options.startTime && 
      m.timestamp <= this.options.endTime
    );

    for (const message of filteredMessages) {
      this.processMessage(message);
    }

    return this.getResult();
  }

  private processMessage(message: MqttMessage): void {
    const event: ReplayEvent = {
      timestamp: message.timestamp,
      type: 'publish',
      clientId: message.clientId,
      details: {
        topic: message.topic,
        payload: message.payload,
        qos: message.qos,
        retain: message.retain,
        dup: message.dup,
        direction: message.direction
      },
      originalMessage: message
    };

    this.timeline.addEvent(event);

    if (message.retain && this.options.processRetainedMessages) {
      if (message.payload === '' || message.payload === '{}') {
        this.retainedMessages.delete(message.topic);
      } else {
        this.retainedMessages.set(message.topic, message);
      }
    }

    this.processShadowMessage(message);
    this.processQoSMessage(message);
    this.deliverToSubscribers(message);
  }

  private processShadowMessage(message: MqttMessage): void {
    const shadowInfo = this.shadowManager.parseShadowMessage(message);
    
    if (!shadowInfo) {
      return;
    }

    if (shadowInfo.operation === 'update' && shadowInfo.state) {
      const existingShadow = this.shadowManager.getShadow(shadowInfo.deviceId);
      
      if (existingShadow && shadowInfo.version !== undefined) {
        const regression = this.shadowManager.checkVersionRegression(
          shadowInfo.deviceId,
          shadowInfo.version,
          message.timestamp
        );

        if (regression.isRegression) {
          this.timeline.addEvent({
            timestamp: message.timestamp,
            type: 'message',
            clientId: message.clientId,
            details: {
              type: 'version_regression',
              deviceId: shadowInfo.deviceId,
              currentVersion: regression.currentVersion,
              incomingVersion: shadowInfo.version,
              history: regression.history
            },
            originalMessage: message
          });
        }
      }

      this.shadowManager.createOrUpdateShadow(
        shadowInfo.deviceId,
        shadowInfo.state,
        message.timestamp
      );

      const delta = this.shadowManager.getDelta(shadowInfo.deviceId);
      if (Object.keys(delta).length > 0) {
        this.timeline.addEvent({
          timestamp: message.timestamp,
          type: 'message',
          clientId: message.clientId,
          details: {
            type: 'shadow_delta',
            deviceId: shadowInfo.deviceId,
            delta
          }
        });
      }
    }
  }

  private processQoSMessage(message: MqttMessage): void {
    if (!this.options.handleQoS) {
      return;
    }

    if (message.qos === 0) {
      return;
    }

    const duplicateCheck = this.sessionManager.checkDuplicateMessage(
      message.clientId,
      message,
      5000
    );

    if (duplicateCheck.isDuplicate) {
      this.timeline.addEvent({
        timestamp: message.timestamp,
        type: 'message',
        clientId: message.clientId,
        details: {
          type: 'duplicate_message',
          qos: message.qos,
          previousMessage: duplicateCheck.previousMessage?.id,
          pendingCount: duplicateCheck.pendingMessages.length
        },
        originalMessage: message
      });
    }

    this.sessionManager.addPendingMessage(message, message.qos);
  }

  private deliverToSubscribers(message: MqttMessage): void {
    const allSessions = this.sessionManager.getAllSessions();
    
    for (const [clientId, session] of allSessions) {
      if (!session.connected) {
        continue;
      }

      if (session.subscriptions.some(sub => this.matchesSubscription(sub, message.topic))) {
        this.timeline.addEvent({
          timestamp: message.timestamp,
          type: 'message',
          clientId,
          details: {
            source: 'publish',
            fromClient: message.clientId,
            topic: message.topic,
            payload: message.payload,
            qos: message.qos
          },
          originalMessage: message
        });
      }
    }
  }

  getResult(): ReplayResult {
    return {
      events: this.timeline.getEvents(),
      retainedMessages: new Map(this.retainedMessages),
      sessions: this.sessionManager.getAllSessions(),
      deviceShadows: this.shadowManager.getAllShadows()
    };
  }

  getTimeline(): Timeline {
    return this.timeline;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getShadowManager(): DeviceShadowManager {
    return this.shadowManager;
  }

  getRetainedMessages(): Map<string, MqttMessage> {
    return new Map(this.retainedMessages);
  }

  reset(): void {
    this.timeline.reset();
    this.retainedMessages.clear();
  }
}
