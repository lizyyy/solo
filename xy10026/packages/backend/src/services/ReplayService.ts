import eventStoreService from './EventStoreService';
import operationLogService from './OperationLogService';
import messageService from './MessageService';
import { Event, Operation, EventType, OperationType, LiveMessage, MessageStatus } from '@live-push/shared';
import logger from '../utils/logger';

interface ReplayOptions {
  speed?: number;
  startVersion?: number;
  endVersion?: number;
  dryRun?: boolean;
}

interface ReplayStep {
  type: 'event' | 'operation';
  data: Event | Operation;
  timestamp: Date;
  description: string;
}

interface ReplayResult {
  steps: ReplayStep[];
  finalState: Partial<LiveMessage>;
  totalDuration: number;
  stepCount: number;
}

interface TraceTimeline {
  traceId: string;
  events: Event[];
  operations: Operation[];
  timeline: Array<{
    timestamp: Date;
    type: 'event' | 'operation';
    data: Event | Operation;
  }>;
}

class ReplayService {
  async replayMessageById(
    messageId: string,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    const { speed = 1, startVersion = 1, endVersion, dryRun = true } = options;

    logger.info('Starting message replay', { messageId, options });

    const events = await eventStoreService.getEventsByAggregateId(
      messageId,
      startVersion,
      endVersion
    );

    const operations = await operationLogService.getOperationsByMessageId(messageId);

    const steps = this.buildReplaySteps(events, operations);
    const stepCount = steps.length;

    let currentState: Partial<LiveMessage> = {};

    for (const step of steps) {
      if (speed > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100 / speed));
      }

      if (step.type === 'event') {
        const event = step.data as Event;
        
        if (!dryRun) {
          currentState = this.applyEventToState(currentState, event);
        } else {
          currentState = this.applyEventToState(currentState, event);
        }

        logger.debug('Replayed event', { 
          eventId: event.id, 
          eventType: event.type,
          version: event.version 
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    logger.info('Message replay completed', { 
      messageId, 
      stepCount, 
      totalDuration 
    });

    return {
      steps,
      finalState: currentState,
      totalDuration,
      stepCount,
    };
  }

  async replayByTraceId(traceId: string): Promise<TraceTimeline> {
    const [events, operations] = await Promise.all([
      eventStoreService.getEventsByTraceId(traceId),
      operationLogService.getOperationsByTraceId(traceId),
    ]);

    const timeline: TraceTimeline['timeline'] = [];

    events.forEach((event) => {
      timeline.push({
        timestamp: event.timestamp,
        type: 'event',
        data: event,
      });
    });

    operations.forEach((operation) => {
      timeline.push({
        timestamp: operation.timestamp,
        type: 'operation',
        data: operation,
      });
    });

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    logger.info('Trace timeline generated', { 
      traceId, 
      eventCount: events.length,
      operationCount: operations.length 
    });

    return {
      traceId,
      events,
      operations,
      timeline,
    };
  }

  async compareStates(
    messageId: string,
    version1: number,
    version2: number
  ): Promise<{
    state1: Partial<LiveMessage>;
    state2: Partial<LiveMessage>;
    differences: string[];
  }> {
    const state1 = await eventStoreService.replayEvents(
      messageId,
      {},
      1,
      version1
    );

    const state2 = await eventStoreService.replayEvents(
      messageId,
      {},
      1,
      version2
    );

    const differences: string[] = [];
    const allKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);

    allKeys.forEach((key) => {
      const val1 = JSON.stringify(state1[key as keyof LiveMessage]);
      const val2 = JSON.stringify(state2[key as keyof LiveMessage]);
      
      if (val1 !== val2) {
        differences.push(key);
      }
    });

    return {
      state1,
      state2,
      differences,
    };
  }

  async getExecutionPath(messageId: string): Promise<Array<{
    version: number;
    eventType: EventType;
    timestamp: Date;
    state: Partial<LiveMessage>;
  }>> {
    const events = await eventStoreService.getEventsByAggregateId(messageId);
    const path: Array<{
      version: number;
      eventType: EventType;
      timestamp: Date;
      state: Partial<LiveMessage>;
    }> = [];

    let currentState: Partial<LiveMessage> = {};

    for (const event of events) {
      currentState = this.applyEventToState(currentState, event);
      
      path.push({
        version: event.version,
        eventType: event.type,
        timestamp: event.timestamp,
        state: { ...currentState },
      });
    }

    return path;
  }

  async diagnoseIssue(messageId: string): Promise<{
    messageHistory: Event[];
    operationHistory: Operation[];
    anomalies: string[];
    recommendations: string[];
  }> {
    const events = await eventStoreService.getEventsByAggregateId(messageId);
    const operations = await operationLogService.getOperationsByMessageId(messageId);

    const anomalies: string[] = [];
    const recommendations: string[] = [];

    const message = await messageService.getMessageById(messageId);
    if (message) {
      if (message.status === 'failed' && message.retryCount >= message.maxRetries) {
        anomalies.push('Message reached max retry count');
        recommendations.push('Consider manual review or increasing retry limit');
      }

      if (message.deliveredAt) {
        const delay = message.deliveredAt.getTime() - message.createdAt.getTime();
        if (delay > 5000) {
          anomalies.push(`High delivery delay: ${delay}ms`);
          recommendations.push('Check message queue performance and consumer lag');
        }
      }
    }

    const statusEvents = events.filter((e) => 
      e.type === EventType.MESSAGE_PUSHED || 
      e.type === EventType.MESSAGE_FAILED
    );

    if (statusEvents.length > 3) {
      anomalies.push('Multiple status changes detected');
      recommendations.push('Review retry logic and consumer idempotency');
    }

    const conflictEvents = events.filter((e) => e.type === EventType.CONFLICT_OCCURRED);
    if (conflictEvents.length > 0) {
      anomalies.push(`Detected ${conflictEvents.length} conflict(s)`);
      recommendations.push('Implement proper versioning and optimistic locking');
    }

    return {
      messageHistory: events,
      operationHistory: operations,
      anomalies,
      recommendations,
    };
  }

  private buildReplaySteps(events: Event[], operations: Operation[]): ReplayStep[] {
    const steps: ReplayStep[] = [];

    events.forEach((event) => {
      steps.push({
        type: 'event',
        data: event,
        timestamp: event.timestamp,
        description: this.describeEvent(event),
      });
    });

    operations.forEach((operation) => {
      steps.push({
        type: 'operation',
        data: operation,
        timestamp: operation.timestamp,
        description: this.describeOperation(operation),
      });
    });

    steps.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return steps;
  }

  private describeEvent(event: Event): string {
    switch (event.type) {
      case EventType.MESSAGE_CREATED:
        return `Message created (v${event.version})`;
      case EventType.MESSAGE_UPDATED:
        return `Message updated (v${event.version})`;
      case EventType.MESSAGE_DELETED:
        return `Message deleted (v${event.version})`;
      case EventType.MESSAGE_PUSHED:
        return `Message pushed to queue (v${event.version})`;
      case EventType.MESSAGE_FAILED:
        return `Message failed (v${event.version})`;
      case EventType.MESSAGE_ROLLBACKED:
        return `Message rolled back (v${event.version})`;
      case EventType.CONFLICT_OCCURRED:
        return `Conflict resolved (v${event.version})`;
      default:
        return `Event: ${event.type} (v${event.version})`;
    }
  }

  private describeOperation(operation: Operation): string {
    const typeMap: Record<OperationType, string> = {
      [OperationType.CREATE_MESSAGE]: 'Create message',
      [OperationType.UPDATE_MESSAGE]: 'Update message',
      [OperationType.DELETE_MESSAGE]: 'Delete message',
      [OperationType.PUSH_MESSAGE]: 'Push message',
      [OperationType.RETRY_MESSAGE]: 'Retry message',
      [OperationType.ROLLBACK_MESSAGE]: 'Rollback message',
    };

    return `${typeMap[operation.type]} by ${operation.operatorName}`;
  }

  private applyEventToState(state: Partial<LiveMessage>, event: Event): Partial<LiveMessage> {
    const data = event.data as Partial<LiveMessage>;

    switch (event.type) {
      case EventType.MESSAGE_CREATED:
        return { ...data };
      case EventType.MESSAGE_UPDATED:
        return { ...state, ...data };
      case EventType.MESSAGE_DELETED:
        return { ...state, status: MessageStatus.FAILED };
      case EventType.MESSAGE_PUSHED:
        return { ...state, ...data };
      case EventType.MESSAGE_FAILED:
        return { ...state, ...data };
      case EventType.MESSAGE_ROLLBACKED:
        return { ...state, ...data };
      default:
        return state;
    }
  }
}

export default new ReplayService();
