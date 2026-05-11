import LiveMessageModel, { LiveMessageDocument } from '../models/LiveMessage';
import ConflictResolutionModel from '../models/ConflictResolution';
import { 
  LiveMessage, 
  MessageType, 
  MessageStatus, 
  EventType,
  OperationType,
  ConflictResolution,
  LiveMessage as LiveMessageInterface
} from '@live-push/shared';
import { generateId, generateTraceId, retry, isRetryableError } from '@live-push/shared';
import logger from '../utils/logger';
import config from '../config';
import sequenceService from './SequenceService';
import distributedLockService from './DistributedLockService';
import cacheService from './CacheService';
import idempotencyService from './IdempotencyService';
import kafkaService from './KafkaService';
import eventStoreService from './EventStoreService';
import operationLogService from './OperationLogService';

interface CreateMessageOptions {
  roomId: string;
  type: MessageType;
  content: string;
  senderId: string;
  senderName: string;
  metadata?: Record<string, unknown>;
  operatorId?: string;
  operatorName?: string;
  idempotencyKey?: string;
  ip?: string;
  userAgent?: string;
}

interface UpdateMessageOptions {
  messageId: string;
  updates: Partial<LiveMessage>;
  expectedVersion?: number;
  operatorId: string;
  operatorName: string;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

interface DeleteMessageOptions {
  messageId: string;
  operatorId: string;
  operatorName: string;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

class MessageService {
  private readonly MESSAGE_CACHE_TTL = 300;

  async createMessage(options: CreateMessageOptions): Promise<{ message: LiveMessage; isDuplicate: boolean }> {
    const traceId = generateTraceId();
    logger.setContext({ traceId });
    
    const { roomId, type, content, senderId, senderName, metadata, operatorId, operatorName, idempotencyKey, ip, userAgent } = options;

    if (idempotencyKey) {
      const existingRecord = await idempotencyService.checkAndSet(idempotencyKey, traceId, 'pending');
      
      if (existingRecord) {
        logger.info('Idempotency key exists, checking status', { 
          idempotencyKey,
          status: existingRecord.status,
          existingMessageId: existingRecord.messageId 
        });
        
        if (existingRecord.status === 'completed') {
          const finalMessageId = existingRecord.messageId;
          if (finalMessageId && finalMessageId !== 'pending') {
            const existingMessage = await this.getMessageById(finalMessageId);
            if (existingMessage) {
              return { message: existingMessage, isDuplicate: true };
            }
          }
        }
        
        if (existingRecord.status === 'pending') {
          logger.info('Previous request still pending, waiting for completion', { idempotencyKey });
          const completedRecord = await idempotencyService.waitForCompletion(idempotencyKey, 10000, 500);
          
          if (completedRecord && completedRecord.status === 'completed') {
            const finalMessageId = completedRecord.messageId;
            if (finalMessageId && finalMessageId !== 'pending') {
              const existingMessage = await this.getMessageById(finalMessageId);
              if (existingMessage) {
                return { message: existingMessage, isDuplicate: true };
              }
            }
          }
          
          if (completedRecord && completedRecord.status === 'failed') {
            logger.warn('Previous request failed, allowing retry', { 
              idempotencyKey, 
              error: completedRecord.error 
            });
            await idempotencyService.invalidate(idempotencyKey);
          }
        }
        
        if (existingRecord.status === 'failed') {
          logger.warn('Previous request failed, allowing retry', { 
            idempotencyKey, 
            error: existingRecord.error 
          });
          await idempotencyService.invalidate(idempotencyKey);
          await idempotencyService.checkAndSet(idempotencyKey, traceId, 'pending');
        }
      }
    }

    const lockKey = `room:${roomId}:message_create`;
    const lock = await distributedLockService.acquire({
      key: lockKey,
      ttl: config.lock.ttl,
      timeout: config.lock.timeout,
    });

    if (!lock) {
      throw new Error('Failed to acquire lock for message creation');
    }

    let message: LiveMessage | null = null;
    
    try {
      const sequence = await sequenceService.getNextSequence(roomId);

      message = {
        id: generateId(),
        roomId,
        type,
        content,
        senderId,
        senderName,
        metadata,
        sequence,
        status: MessageStatus.PENDING,
        retryCount: 0,
        maxRetries: config.retry.maxRetries,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      const messageDoc = new LiveMessageModel({
        _id: message.id,
        ...message,
      });

      await messageDoc.save();

      if (idempotencyKey) {
        await idempotencyService.setResponse(
          idempotencyKey, 
          { messageId: message.id },
          message.id
        );
      }

      await eventStoreService.createEvent(
        EventType.MESSAGE_CREATED,
        message.id,
        message,
        traceId,
        { ip, userAgent }
      );

      await operationLogService.recordOperation(
        message.id,
        OperationType.CREATE_MESSAGE,
        operatorId || senderId,
        operatorName || senderName,
        traceId,
        {
          afterState: message,
          ip,
          userAgent,
        }
      );

      await this.invalidateRoomCache(roomId);

      logger.info('Message created', { 
        messageId: message.id, 
        roomId, 
        sequence,
        traceId 
      });

      return { message, isDuplicate: false };

    } catch (error) {
      if (idempotencyKey && message) {
        await idempotencyService.setFailed(
          idempotencyKey,
          error instanceof Error ? error.message : 'Unknown error',
          message.id
        );
      } else if (idempotencyKey) {
        await idempotencyService.setFailed(
          idempotencyKey,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      throw error;
    } finally {
      await distributedLockService.release(lock);
    }
  }

  async sendMessageToQueue(message: LiveMessage, traceId: string): Promise<void> {
    await kafkaService.sendMessage(message.roomId, message, traceId);
    
    await this.updateMessageStatus(message.id, MessageStatus.PROCESSING, traceId);
    
    await eventStoreService.createEvent(
      EventType.MESSAGE_PUSHED,
      message.id,
      { status: MessageStatus.PROCESSING },
      traceId
    );
  }

  async getMessageById(messageId: string): Promise<LiveMessage | null> {
    const cacheKey = `message:${messageId}`;
    
    const cached = await cacheService.get<LiveMessage>(cacheKey);
    if (cached) {
      return cached;
    }

    const messageDoc = await LiveMessageModel.findById(messageId);
    if (!messageDoc) {
      return null;
    }

    const message = this.toMessage(messageDoc);
    await cacheService.set(cacheKey, message, this.MESSAGE_CACHE_TTL);
    
    return message;
  }

  async getMessagesByRoom(
    roomId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: MessageStatus;
      type?: MessageType;
      startTime?: Date;
      endTime?: Date;
    } = {}
  ): Promise<{ messages: LiveMessage[]; total: number }> {
    const { limit = 50, offset = 0, status, type, startTime, endTime } = options;
    
    const cacheKey = `messages:${roomId}:${limit}:${offset}:${status || 'all'}:${type || 'all'}:${startTime?.getTime() || 0}:${endTime?.getTime() || 0}`;
    
    const cached = await cacheService.get<{ messages: LiveMessage[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    const query: any = { roomId };

    if (status) {
      query['status'] = status;
    }

    if (type) {
      query['type'] = type;
    }

    if (startTime || endTime) {
      query['createdAt'] = {};
      if (startTime) query['createdAt'].$gte = startTime;
      if (endTime) query['createdAt'].$lte = endTime;
    }

    const [messageDocs, total] = await Promise.all([
      LiveMessageModel.find(query)
        .sort({ sequence: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit),
      LiveMessageModel.countDocuments(query),
    ]);

    const messages = messageDocs.map((doc) => this.toMessage(doc));
    const result = { messages, total };

    await cacheService.set(cacheKey, result, this.MESSAGE_CACHE_TTL / 2);

    return result;
  }

  async updateMessage(options: UpdateMessageOptions): Promise<LiveMessage> {
    const traceId = generateTraceId();
    logger.setContext({ traceId });

    const { messageId, updates, expectedVersion, operatorId, operatorName, reason, ip, userAgent } = options;

    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    if (expectedVersion !== undefined && message.version !== expectedVersion) {
      const resolution = await this.resolveConflict(
        message,
        updates,
        expectedVersion,
        traceId
      );

      if (!resolution.resolved) {
        throw new Error(`Version conflict: expected ${expectedVersion}, current ${message.version}`);
      }

      logger.warn('Conflict resolved', { 
        messageId, 
        winner: resolution.winner,
        traceId 
      });

      if (resolution.winner === 'current') {
        return message;
      }

      if (resolution.winner === 'merged' && resolution.mergedData) {
        Object.assign(updates, resolution.mergedData);
      }
    }

    const lockKey = `message:${messageId}:update`;
    const lock = await distributedLockService.acquire({
      key: lockKey,
      ttl: config.lock.ttl,
      timeout: config.lock.timeout,
    });

    if (!lock) {
      throw new Error('Failed to acquire lock for message update');
    }

    try {
      const beforeState = { ...message };
      const newVersion = message.version + 1;

      const updatedMessage: Partial<LiveMessage> = {
        ...updates,
        version: newVersion,
        updatedAt: new Date(),
      };

      const result = await LiveMessageModel.updateOne(
        { _id: messageId, version: message.version },
        { $set: updatedMessage }
      );

      if (result.matchedCount === 0) {
        throw new Error('Message updated by another process');
      }

      await cacheService.delete(`message:${messageId}`);
      await this.invalidateRoomCache(message.roomId);

      await eventStoreService.createEvent(
        EventType.MESSAGE_UPDATED,
        messageId,
        updatedMessage,
        traceId,
        { expectedVersion, ip, userAgent }
      );

      await operationLogService.recordOperation(
        messageId,
        OperationType.UPDATE_MESSAGE,
        operatorId,
        operatorName,
        traceId,
        {
          beforeState,
          afterState: updatedMessage,
          reason,
          ip,
          userAgent,
        }
      );

      const updated = await this.getMessageById(messageId);
      if (!updated) {
        throw new Error('Failed to retrieve updated message');
      }

      logger.info('Message updated', { messageId, newVersion, traceId });

      return updated;

    } finally {
      await distributedLockService.release(lock);
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    traceId: string,
    additionalData?: Partial<LiveMessage>
  ): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      logger.warn('Message not found for status update', { messageId });
      return;
    }

    const updateData: Partial<LiveMessage> = {
      status,
      version: message.version + 1,
      updatedAt: new Date(),
      ...additionalData,
    };

    if (status === MessageStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    if (status === MessageStatus.RETRYING || status === MessageStatus.FAILED) {
      updateData.retryCount = message.retryCount + 1;
    }

    await LiveMessageModel.updateOne(
      { _id: messageId },
      { $set: updateData }
    );

    await cacheService.delete(`message:${messageId}`);
    await this.invalidateRoomCache(message.roomId);

    logger.debug('Message status updated', { messageId, status, traceId });
  }

  async deleteMessage(options: DeleteMessageOptions): Promise<void> {
    const traceId = generateTraceId();
    logger.setContext({ traceId });

    const { messageId, operatorId, operatorName, reason, ip, userAgent } = options;

    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const lockKey = `message:${messageId}:delete`;
    const lock = await distributedLockService.acquire({
      key: lockKey,
      ttl: config.lock.ttl,
      timeout: config.lock.timeout,
    });

    if (!lock) {
      throw new Error('Failed to acquire lock for message deletion');
    }

    try {
      await LiveMessageModel.deleteOne({ _id: messageId });

      await cacheService.delete(`message:${messageId}`);
      await this.invalidateRoomCache(message.roomId);

      await eventStoreService.createEvent(
        EventType.MESSAGE_DELETED,
        messageId,
        message,
        traceId
      );

      await operationLogService.recordOperation(
        messageId,
        OperationType.DELETE_MESSAGE,
        operatorId,
        operatorName,
        traceId,
        {
          beforeState: message,
          reason,
          ip,
          userAgent,
        }
      );

      logger.info('Message deleted', { messageId, traceId });

    } finally {
      await distributedLockService.release(lock);
    }
  }

  async retryMessage(
    messageId: string,
    operatorId: string,
    operatorName: string,
    traceId: string
  ): Promise<LiveMessage> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    if (message.retryCount >= message.maxRetries) {
      throw new Error('Max retries exceeded');
    }

    await this.updateMessageStatus(messageId, MessageStatus.RETRYING, traceId);

    await operationLogService.recordOperation(
      messageId,
      OperationType.RETRY_MESSAGE,
      operatorId,
      operatorName,
      traceId,
      {
        beforeState: message,
        reason: 'Manual retry',
      }
    );

    await retry(
      async () => {
        await this.sendMessageToQueue(message, traceId);
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        shouldRetry: isRetryableError,
      }
    );

    const updated = await this.getMessageById(messageId);
    if (!updated) {
      throw new Error('Failed to retrieve message after retry');
    }

    logger.info('Message retried', { messageId, traceId });

    return updated;
  }

  async rollbackMessage(
    messageId: string,
    operatorId: string,
    operatorName: string,
    reason: string,
    traceId: string
  ): Promise<LiveMessage> {
    const events = await eventStoreService.getEventsByAggregateId(messageId);
    
    if (events.length < 2) {
      throw new Error('Nothing to rollback');
    }

    const previousState = await eventStoreService.replayEvents(
      messageId,
      {},
      1,
      events.length - 1
    );

    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    await this.updateMessage({
      messageId,
      updates: previousState as Partial<LiveMessage>,
      operatorId,
      operatorName,
      reason,
    });

    await eventStoreService.createEvent(
      EventType.MESSAGE_ROLLBACKED,
      messageId,
      { reason },
      traceId
    );

    await operationLogService.recordOperation(
      messageId,
      OperationType.ROLLBACK_MESSAGE,
      operatorId,
      operatorName,
      traceId,
      {
        beforeState: message,
        afterState: previousState,
        reason,
      }
    );

    const rolledBack = await this.getMessageById(messageId);
    if (!rolledBack) {
      throw new Error('Failed to retrieve rolled back message');
    }

    logger.info('Message rolled back', { messageId, traceId });

    return rolledBack;
  }

  private async resolveConflict(
    currentMessage: LiveMessage,
    proposedUpdates: Partial<LiveMessage>,
    expectedVersion: number,
    traceId: string
  ): Promise<ConflictResolution> {
    const conflictResolution: ConflictResolution = {
      id: generateId(),
      messageId: currentMessage.id,
      baseVersion: expectedVersion,
      currentVersion: currentMessage.version,
      proposedVersion: expectedVersion,
      resolved: false,
      winner: 'current',
      resolvedAt: new Date(),
    };

    const updatableFields = ['content', 'metadata'];
    const conflictFields = Object.keys(proposedUpdates).filter(
      (field) => !updatableFields.includes(field)
    );

    if (conflictFields.length > 0) {
      conflictResolution.winner = 'current';
      conflictResolution.resolved = true;
    } else {
      conflictResolution.winner = 'merged';
      conflictResolution.mergedData = proposedUpdates;
      conflictResolution.resolved = true;
    }

    await ConflictResolutionModel.create({
      _id: conflictResolution.id,
      ...conflictResolution,
    });

    await eventStoreService.createEvent(
      EventType.CONFLICT_OCCURRED,
      currentMessage.id,
      conflictResolution,
      traceId
    );

    return conflictResolution;
  }

  private async invalidateRoomCache(roomId: string): Promise<void> {
    await cacheService.invalidatePattern(`messages:${roomId}:*`);
  }

  private toMessage(doc: LiveMessageDocument): LiveMessage {
    return {
      id: doc._id,
      roomId: doc.roomId,
      type: doc.type as MessageType,
      content: doc.content,
      senderId: doc.senderId,
      senderName: doc.senderName,
      metadata: doc.metadata as Record<string, unknown> | undefined,
      sequence: doc.sequence,
      status: doc.status as MessageStatus,
      retryCount: doc.retryCount,
      maxRetries: doc.maxRetries,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deliveredAt: doc.deliveredAt,
      version: doc.version,
    };
  }
}

export default new MessageService();
