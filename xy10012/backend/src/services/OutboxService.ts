import { Queue, Worker, QueueEvents } from 'bullmq';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export class OutboxService {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;

  constructor() {
    this.queue = new Queue('outbox', { connection: redis });
    this.worker = new Worker('outbox', this.processMessage.bind(this), {
      connection: redis,
      concurrency: 5,
    });
    this.queueEvents = new QueueEvents('outbox', { connection: redis });

    this.worker.on('completed', (job) => {
      logger.info('Outbox job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Outbox job failed', { jobId: job?.id, error: err.message });
    });
  }

  async enqueueEvent(event: DomainEvent, tx: any = prisma): Promise<void> {
    const messageId = uuidv4();

    await tx.outboxMessage.create({
      data: {
        id: messageId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as any,
        status: 'PENDING',
      },
    });

    await this.queue.add(
      `process-${messageId}`,
      { messageId },
      {
        jobId: messageId,
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }

  private async processMessage(job: any): Promise<void> {
    const { messageId } = job.data;

    const message = await prisma.outboxMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.status !== 'PENDING') {
      return;
    }

    try {
      await this.dispatchEvent({
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        eventType: message.eventType,
        payload: message.payload as Record<string, unknown>,
      });

      await prisma.outboxMessage.update({
        where: { id: messageId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error: any) {
      await prisma.outboxMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });

      throw error;
    }
  }

  private async dispatchEvent(event: DomainEvent): Promise<void> {
    logger.info('Dispatching domain event', {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
    });
  }

  async retryFailedMessages(maxRetries: number = 3): Promise<number> {
    const failedMessages = await prisma.outboxMessage.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: maxRetries },
      },
    });

    let retried = 0;

    for (const message of failedMessages) {
      await this.queue.add(
        `retry-${message.id}`,
        { messageId: message.id },
        {
          jobId: `retry-${message.id}`,
          delay: 1000 * message.retryCount,
          attempts: 3 - message.retryCount,
        }
      );

      await prisma.outboxMessage.update({
        where: { id: message.id },
        data: {
          status: 'PENDING',
          errorMessage: null,
        },
      });

      retried++;
    }

    return retried;
  }

  async cleanupProcessedMessages(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.outboxMessage.deleteMany({
      where: {
        status: 'PROCESSED',
        processedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

export const outboxService = new OutboxService();