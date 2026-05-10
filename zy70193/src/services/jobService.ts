import prisma from '../prisma';

export interface BackgroundJobPayload {
  projectId?: string;
  archiveId?: string;
  [key: string]: unknown;
}

export interface JobExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export type JobHandler = (payload: BackgroundJobPayload, jobId: string) => Promise<JobExecutionResult>;

const jobHandlers: Map<string, JobHandler> = new Map();

export function registerJobHandler(type: string, handler: JobHandler) {
  jobHandlers.set(type, handler);
}

export async function createBackgroundJob(type: string, payload: BackgroundJobPayload, maxRetries = 3) {
  return prisma.backgroundJob.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      maxRetries,
      status: 'pending',
    },
  });
}

export async function getPendingJobs() {
  return prisma.backgroundJob.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      retryCount: { lt: prisma.backgroundJob.fields.maxRetries },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getJobById(jobId: string) {
  return prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });
}

export async function getJobsByType(type: string) {
  return prisma.backgroundJob.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
  });
}

export async function retryJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('任务不存在');
  }

  if (job.status === 'completed') {
    throw new Error('任务已完成，无需重试');
  }

  return prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      errorMessage: null,
      failedAt: null,
      startedAt: null,
      completedAt: null,
      logs: null,
    },
  });
}

export async function executeJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('任务不存在');
  }

  if (job.retryCount >= job.maxRetries) {
    throw new Error('任务已达到最大重试次数');
  }

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: new Date(),
      retryCount: job.retryCount + 1,
      logs: JSON.stringify({ startedAt: new Date().toISOString() }),
    },
  });

  const handler = jobHandlers.get(job.type);
  if (!handler) {
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        errorMessage: `未找到任务处理程序: ${job.type}`,
      },
    });
    throw new Error(`未找到任务处理程序: ${job.type}`);
  }

  try {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const result = await handler(payload, jobId);

    if (result.success) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: result.result ? JSON.stringify(result.result) : null,
        },
      });
      return { success: true, result: result.result };
    } else {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: result.error || '任务执行失败',
        },
      });
      return { success: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}

export async function executePendingJobs() {
  const jobs = await getPendingJobs();
  const results = [];

  for (const job of jobs) {
    try {
      const result = await executeJob(job.id);
      results.push({ jobId: job.id, type: job.type, ...result });
    } catch (error) {
      results.push({
        jobId: job.id,
        type: job.type,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
