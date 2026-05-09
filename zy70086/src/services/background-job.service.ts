import { Repository, In } from 'typeorm';
import { BackgroundJob, JobStatus, JobType } from '../entities/background-job.entity';
import { AppDataSource } from '../database/data-source';

export { JobType };

export interface CreateJobOptions {
  maxAttempts?: number;
  retryIntervalSeconds?: number;
  nextRunAt?: Date;
  relatedBizType?: string;
  relatedBizId?: string;
}

export class BackgroundJobService {
  private repo: Repository<BackgroundJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(BackgroundJob);
  }

  async createJob(
    jobType: JobType,
    payload: any,
    options?: CreateJobOptions,
  ): Promise<BackgroundJob> {
    const job = this.repo.create({
      jobType,
      payloadJson: JSON.stringify(payload),
      status: JobStatus.PENDING,
      maxAttempts: options?.maxAttempts ?? 3,
      retryIntervalSeconds: options?.retryIntervalSeconds ?? 60,
      nextRunAt: options?.nextRunAt ?? new Date(),
      relatedBizType: options?.relatedBizType ?? null,
      relatedBizId: options?.relatedBizId ?? null,
    });
    return this.repo.save(job);
  }

  async getPendingJobs(batchSize: number = 10): Promise<BackgroundJob[]> {
    const now = new Date();
    return this.repo.find({
      where: [
        { status: JobStatus.PENDING },
        { status: JobStatus.RETRYING },
      ],
      take: batchSize,
      order: { createdAt: 'ASC' },
    });
  }

  async markRunning(jobId: string): Promise<void> {
    await this.repo.update(
      { id: jobId },
      { status: JobStatus.RUNNING, lastRunAt: new Date() },
    );
  }

  async markSuccess(jobId: string, result?: any): Promise<void> {
    await this.repo.update(
      { id: jobId },
      {
        status: JobStatus.COMPLETED,
        resultJson: result ? JSON.stringify(result) : null,
        lastError: null,
      },
    );
  }

  async markFailed(jobId: string, error: string): Promise<BackgroundJob> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    const newAttemptCount = job.attemptCount + 1;
    const shouldRetry = newAttemptCount < job.maxAttempts;

    if (shouldRetry) {
      const nextRunAt = new Date(Date.now() + job.retryIntervalSeconds * 1000);
      job.status = JobStatus.RETRYING;
      job.attemptCount = newAttemptCount;
      job.lastError = error;
      job.nextRunAt = nextRunAt;
      await this.repo.save(job);
      return job;
    } else {
      job.status = JobStatus.DEAD;
      job.attemptCount = newAttemptCount;
      job.lastError = error;
      job.nextRunAt = null;
      await this.repo.save(job);
      return job;
    }
  }

  async getJobById(jobId: string): Promise<BackgroundJob | null> {
    return this.repo.findOne({ where: { id: jobId } });
  }

  async retryDeadJob(jobId: string): Promise<BackgroundJob> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (job.status !== JobStatus.DEAD) throw new Error('只有已死亡的任务才能重试');

    job.status = JobStatus.RETRYING;
    job.attemptCount = 0;
    job.nextRunAt = new Date();
    job.lastError = null;
    return this.repo.save(job);
  }

  async getDeadJobs(limit: number = 50): Promise<BackgroundJob[]> {
    return this.repo.find({
      where: { status: JobStatus.DEAD },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }
}
