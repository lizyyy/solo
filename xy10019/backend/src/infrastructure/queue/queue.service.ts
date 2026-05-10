import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskPriority } from '@prisma/client';

export interface TaskPayload {
  requestId?: string;
  userId?: string;
  data: any;
}

export interface TaskHandler {
  handle(payload: any, job: Job): Promise<any>;
}

@Injectable()
export class QueueService implements OnModuleInit {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {}

  onModuleInit() {
    this.registerQueue('inventory');
    this.registerQueue('export');
    this.registerQueue('audit');
  }

  private getRedisConnection() {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || '',
      db: this.configService.get<number>('REDIS_DB', 0),
    };
  }

  registerQueue(queueName: string): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const queue = new Queue(queueName, {
      connection: this.getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });

    this.queues.set(queueName, queue);
    this.logger.log(`队列已注册: ${queueName}`);

    return queue;
  }

  registerWorker(
    queueName: string,
    handler: TaskHandler,
    concurrency: number = 1,
  ) {
    this.handlers.set(queueName, handler);

    const worker = new Worker(
      queueName,
      async (job) => {
        this.logger.log(`开始处理任务: ${job.id} (${queueName})`);
        
        await this.prismaService.backgroundTask.update({
          where: { jobId: job.id },
          data: {
            status: TaskStatus.PROCESSING,
            startedAt: new Date(),
          },
        });

        try {
          const result = await handler.handle(job.data, job);
          
          await this.prismaService.backgroundTask.update({
            where: { jobId: job.id },
            data: {
              status: TaskStatus.COMPLETED,
              result: result as any,
              completedAt: new Date(),
            },
          });

          this.logger.log(`任务完成: ${job.id}`);
          return result;
        } catch (error) {
          this.logger.error(`任务失败: ${job.id}`, error.stack);
          
          const task = await this.prismaService.backgroundTask.findUnique({
            where: { jobId: job.id },
          });

          await this.prismaService.backgroundTask.update({
            where: { jobId: job.id },
            data: {
              status: job.attemptsMade < (task?.maxRetryCount ?? 3) 
                ? TaskStatus.RETRY 
                : TaskStatus.FAILED,
              retryCount: (task?.retryCount ?? 0) + 1,
              errorMessage: error.message,
            },
          });

          throw error;
        }
      },
      {
        connection: this.getRedisConnection(),
        concurrency,
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Worker 任务失败: ${job?.id}`, err.stack);
    });

    worker.on('completed', (job) => {
      this.logger.log(`Worker 任务完成: ${job.id}`);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker 已启动: ${queueName}`);
  }

  async addTask(
    queueName: string,
    taskName: string,
    taskType: string,
    payload: TaskPayload,
    options: JobsOptions & {
      dependsOnTaskId?: string;
      sequenceNumber?: number;
      maxRetryCount?: number;
      priority?: TaskPriority;
    } = {},
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`队列不存在: ${queueName}`);
    }

    const {
      dependsOnTaskId,
      sequenceNumber,
      maxRetryCount = 3,
      priority,
      ...jobOptions
    } = options;

    const bullmqPriority = this.convertPriority(priority);

    const taskRecord = await this.prismaService.backgroundTask.create({
      data: {
        taskType,
        name: taskName,
        status: TaskStatus.PENDING,
        priority: priority || TaskPriority.NORMAL,
        payload: payload as any,
        maxRetryCount,
        userId: payload.userId,
        dependsOnTaskId,
        sequenceNumber,
      },
    });

    const job = await queue.add(
      taskType,
      { ...payload, taskId: taskRecord.id },
      {
        ...jobOptions,
        jobId: taskRecord.id,
        priority: bullmqPriority,
        attempts: maxRetryCount,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    await this.prismaService.backgroundTask.update({
      where: { id: taskRecord.id },
      data: { jobId: job.id },
    });

    this.logger.log(`任务已添加: ${taskRecord.id} -> ${job.id}`);
    return taskRecord.id;
  }

  async addSequentialTasks(
    queueName: string,
    tasks: Array<{
      taskName: string;
      taskType: string;
      payload: TaskPayload;
      priority?: TaskPriority;
    }>,
    userId?: string,
  ): Promise<string[]> {
    const taskIds: string[] = [];
    let previousTaskId: string | undefined;

    for (let i = 0; i < tasks.length; i++) {
      const taskId = await this.addTask(
        queueName,
        tasks[i].taskName,
        tasks[i].taskType,
        { ...tasks[i].payload, userId },
        {
          sequenceNumber: i,
          dependsOnTaskId: previousTaskId,
          priority: tasks[i].priority,
        } as any,
      );
      taskIds.push(taskId);
      previousTaskId = taskId;
    }

    return taskIds;
  }

  async getTaskStatus(taskId: string) {
    const task = await this.prismaService.backgroundTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    let progress = null;
    if (task.jobId) {
      const queue = this.queues.values().next().value;
      if (queue) {
        const job = await queue.getJob(task.jobId);
        if (job) {
          progress = job.progress();
        }
      }
    }

    return {
      ...task,
      progress,
    };
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.prismaService.backgroundTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.jobId) {
      const queue = this.queues.values().next().value;
      if (queue) {
        const job = await queue.getJob(task.jobId);
        if (job) {
          await job.remove();
        }
      }
    }

    await this.prismaService.backgroundTask.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
    });

    return true;
  }

  async listTasks(
    status?: TaskStatus,
    limit: number = 50,
    offset: number = 0,
  ) {
    const where = status ? { status } : {};

    const [tasks, total] = await Promise.all([
      this.prismaService.backgroundTask.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.backgroundTask.count({ where }),
    ]);

    return { tasks, total };
  }

  private convertPriority(priority?: TaskPriority): number {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return 1;
      case TaskPriority.HIGH:
        return 5;
      case TaskPriority.LOW:
        return 20;
      case TaskPriority.NORMAL:
      default:
        return 10;
    }
  }
}
