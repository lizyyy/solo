import Queue from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import redisService from './redis.service';

export interface TaskPayload {
  taskType: string;
  data: Record<string, unknown>;
  correlationId?: string;
  parentTaskId?: string;
  priority?: number;
}

export interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type TaskHandler = (data: Record<string, unknown>, job: Queue.Job) => Promise<TaskResult>;

interface TaskDefinition {
  name: string;
  handler: TaskHandler;
  dependencies?: string[];
  retryAttempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

interface TaskGraph {
  [taskName: string]: {
    dependencies: string[];
    handler?: TaskHandler;
  };
}

class TaskQueueService {
  private queues: Map<string, Queue.Queue> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private taskDefinitions: Map<string, TaskDefinition> = new Map();

  private readonly redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  };

  constructor() {
    this.setupDefaultQueues();
  }

  private setupDefaultQueues(): void {
    this.createQueue('default');
    this.createQueue('notifications');
    this.createQueue('exports');
    this.createQueue('followup-reminders');
    this.createQueue('compensation');
  }

  createQueue(name: string, options?: Queue.QueueOptions): Queue.Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
      ...options,
    });

    queue.on('error', (error) => {
      logger.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} in queue ${name} failed:`, error);
    });

    queue.on('completed', (job) => {
      logger.debug(`Job ${job.id} in queue ${name} completed`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  registerTask(definition: TaskDefinition): void {
    this.taskDefinitions.set(definition.name, definition);

    if (definition.handler) {
      this.handlers.set(definition.name, definition.handler);
    }
  }

  registerHandler(taskName: string, handler: TaskHandler): void {
    this.handlers.set(taskName, handler);
  }

  async addTask(
    queueName: string,
    taskType: string,
    payload: TaskPayload,
    options?: Queue.JobOptions
  ): Promise<Queue.Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobId = payload.data.jobId || uuidv4();
    const taskPayload = {
      taskType,
      ...payload,
      jobId,
      createdAt: new Date().toISOString(),
    };

    const job = await queue.add(taskType, taskPayload, {
      jobId,
      ...options,
    });

    logger.info(
      `Task added: ${taskType} to queue ${queueName} with jobId ${jobId}`
    );

    return job;
  }

  async executeTaskGraph(
    queueName: string,
    tasks: { name: string; data: Record<string, unknown> }[],
    taskGraph: TaskGraph,
    correlationId?: string
  ): Promise<string> {
    const actualCorrelationId = correlationId || uuidv4();

    const sortedTasks = this.topologicalSort(tasks, taskGraph);

    for (const task of sortedTasks) {
      const definition = this.taskDefinitions.get(task.name);
      const handler = this.handlers.get(task.name);

      if (!handler) {
        logger.warn(`No handler registered for task: ${task.name}`);
        continue;
      }

      await this.addTask(
        queueName,
        task.name,
        {
          taskType: task.name,
          data: task.data,
          correlationId: actualCorrelationId,
        },
        {
          priority: definition?.priority,
          attempts: definition?.retryAttempts || 3,
          backoff: definition?.backoff,
        }
      );
    }

    return actualCorrelationId;
  }

  private topologicalSort(
    tasks: { name: string; data: Record<string, unknown> }[],
    taskGraph: TaskGraph
  ): { name: string; data: Record<string, unknown> }[] {
    const visited = new Set<string>();
    const result: { name: string; data: Record<string, unknown> }[] = [];

    const visit = (taskName: string, ancestors: Set<string>) => {
      if (ancestors.has(taskName)) {
        throw new Error(`Circular dependency detected: ${taskName}`);
      }

      if (visited.has(taskName)) {
        return;
      }

      ancestors.add(taskName);

      const taskDef = taskGraph[taskName];
      if (taskDef?.dependencies) {
        for (const dep of taskDef.dependencies) {
          visit(dep, ancestors);
        }
      }

      ancestors.delete(taskName);
      visited.add(taskName);

      const taskData = tasks.find((t) => t.name === taskName)?.data || {};
      result.push({ name: taskName, data: taskData });
    };

    for (const task of tasks) {
      visit(task.name, new Set());
    }

    return result;
  }

  processQueue(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.process(async (job) => {
      const taskType = job.data.taskType;
      const handler = this.handlers.get(taskType);

      if (!handler) {
        logger.error(`No handler for task type: ${taskType}`);
        throw new Error(`No handler for task type: ${taskType}`);
      }

      logger.info(`Processing task: ${taskType}, jobId: ${job.id}`);

      try {
        const result = await handler(job.data, job);
        return result;
      } catch (error) {
        logger.error(`Task failed: ${taskType}, jobId: ${job.id}`, error);
        throw error;
      }
    });
  }

  async getJobStatus(queueName: string, jobId: string): Promise<{
    status: Queue.JobStatus;
    progress?: number;
    result?: unknown;
    failedReason?: string;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      status: await job.getState(),
      progress: job.progress() as number,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  async cancelJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  async getQueueMetrics(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down task queues...');

    for (const [name, queue] of this.queues) {
      logger.info(`Closing queue: ${name}`);
      await queue.close();
    }

    this.queues.clear();
    logger.info('All queues closed');
  }
}

export const taskQueueService = new TaskQueueService();
export default taskQueueService;
