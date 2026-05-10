import { v4 as uuidv4 } from 'uuid';
import { 
  ThawJob, 
  ThawJobStatus, 
  ProcessingResult,
  StorageClass,
  ObjectMetadata
} from '../models/types';
import { runSql, querySql, queryOne } from '../database/index';
import { getObjectById } from './lifecycleService';
import { estimateRetrievalCost } from './costService';
import { logOperation } from './loggingService';

interface FailedTaskRecord {
  task_id: string;
  task_type: string;
  object_id: string;
  failure_reason: string;
  failed_at: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  task_data: string;
}

const RETRIEVAL_TIME_BY_TIER: Record<string, number> = {
  'expedited': 1,
  'standard': 5,
  'bulk': 12
};

export async function createThawJob(params: {
  objectId: string;
  requestedBy: string;
  thawDays: number;
  retrievalTier: 'expedited' | 'standard' | 'bulk';
  requestId: string;
  userId: string;
}): Promise<ProcessingResult> {
  const object = await getObjectById(params.objectId);
  
  if (!object) {
    return {
      success: false,
      error: 'Object not found'
    };
  }
  
  if (object.storageClass !== StorageClass.ARCHIVE && 
      object.storageClass !== StorageClass.DEEP_ARCHIVE) {
    return {
      success: false,
      error: `Object is not in archive storage class (current: ${object.storageClass})`,
      warnings: ['Object does not need thawing']
    };
  }
  
  if (object.currentThawJobId) {
    const existingJob = await getThawJobById(object.currentThawJobId);
    if (existingJob && 
        (existingJob.status === ThawJobStatus.PENDING || 
         existingJob.status === ThawJobStatus.RESTORING)) {
      return {
        success: false,
        error: 'Object already has an active thaw job',
        thawJobId: existingJob.thawJobId
      };
    }
  }
  
  const costEstimate = estimateRetrievalCost(
    object.objectId,
    object.objectKey,
    object.size,
    object.storageClass,
    params.retrievalTier
  );
  
  const thawJobId = uuidv4();
  const now = new Date();
  
  const job: ThawJob = {
    thawJobId,
    objectId: params.objectId,
    objectKey: object.objectKey,
    bucketName: object.bucketName,
    requestedBy: params.requestedBy,
    requestedAt: now.toISOString(),
    status: ThawJobStatus.PENDING,
    thawDays: params.thawDays,
    retrievalTier: params.retrievalTier,
    progress: 0,
    retryCount: 0,
    maxRetries: 3
  };
  
  try {
    await runSql(
      `INSERT INTO thaw_jobs (
        thaw_job_id, object_id, object_key, bucket_name, requested_by,
        requested_at, status, thaw_days, retrieval_tier, progress,
        retry_count, max_retries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.thawJobId,
        job.objectId,
        job.objectKey,
        job.bucketName,
        job.requestedBy,
        job.requestedAt,
        job.status,
        job.thawDays,
        job.retrievalTier,
        job.progress,
        job.retryCount,
        job.maxRetries
      ]
    );
    
    await runSql(
      `UPDATE objects SET current_thaw_job_id = ? WHERE object_id = ?`,
      [job.thawJobId, params.objectId]
    );
    
    const logId = await logOperation({
      operation: 'THAW_REQUEST',
      objectId: params.objectId,
      bucketName: object.bucketName,
      objectKey: object.objectKey,
      requestId: params.requestId,
      userId: params.userId,
      status: 'success',
      details: `Thaw job created with tier ${params.retrievalTier}`,
      costEstimate: costEstimate.estimatedCost
    });
    
    return {
      success: true,
      objectId: params.objectId,
      thawJobId: job.thawJobId,
      costEstimate,
      logId
    };
  } catch (error: any) {
    const logId = await logOperation({
      operation: 'THAW_REQUEST',
      objectId: params.objectId,
      bucketName: object.bucketName,
      objectKey: object.objectKey,
      requestId: params.requestId,
      userId: params.userId,
      status: 'failed',
      details: `Failed to create thaw job: ${error.message}`,
      costEstimate: costEstimate.estimatedCost
    });
    
    return {
      success: false,
      error: error.message,
      logId
    };
  }
}

export async function getThawJobById(thawJobId: string): Promise<ThawJob | undefined> {
  const row = await queryOne<any>(
    `SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`,
    [thawJobId]
  );
  
  if (!row) return undefined;
  
  return mapRowToThawJob(row);
}

export async function getThawJobsByObject(objectId: string): Promise<ThawJob[]> {
  const rows = await querySql<any>(
    `SELECT * FROM thaw_jobs WHERE object_id = ? ORDER BY requested_at DESC`,
    [objectId]
  );
  
  return rows.map(mapRowToThawJob);
}

export async function processPendingThawJobs(): Promise<ProcessingResult[]> {
  const pendingJobs = await querySql<any>(
    `SELECT * FROM thaw_jobs WHERE status IN (?, ?) ORDER BY requested_at ASC`,
    [ThawJobStatus.PENDING, ThawJobStatus.RETRY_PENDING]
  );
  
  const results: ProcessingResult[] = [];
  
  for (const row of pendingJobs) {
    const job = mapRowToThawJob(row);
    const result = await processThawJob(job);
    results.push(result);
  }
  
  return results;
}

async function processThawJob(job: ThawJob): Promise<ProcessingResult> {
  const object = await getObjectById(job.objectId);
  if (!object) {
    return {
      success: false,
      error: 'Object not found'
    };
  }
  
  if (job.status === ThawJobStatus.PENDING) {
    await runSql(
      `UPDATE thaw_jobs SET status = ?, started_at = ?, progress = ? WHERE thaw_job_id = ?`,
      [ThawJobStatus.RESTORING, new Date().toISOString(), 10, job.thawJobId]
    );
    
    return {
      success: true,
      objectId: job.objectId,
      thawJobId: job.thawJobId
    };
  }
  
  if (job.status === ThawJobStatus.RETRY_PENDING) {
    const newRetryCount = job.retryCount + 1;
    
    if (newRetryCount > job.maxRetries) {
      await runSql(
        `UPDATE thaw_jobs SET status = ?, failure_reason = ? WHERE thaw_job_id = ?`,
        [ThawJobStatus.FAILED, 'Max retries exceeded', job.thawJobId]
      );
      
      return {
        success: false,
        objectId: job.objectId,
        thawJobId: job.thawJobId,
        error: 'Max retries exceeded'
      };
    }
    
    await runSql(
      `UPDATE thaw_jobs SET 
        status = ?, 
        started_at = ?, 
        progress = ?,
        retry_count = ?,
        failure_reason = NULL
      WHERE thaw_job_id = ?`,
      [ThawJobStatus.RESTORING, new Date().toISOString(), 10, newRetryCount, job.thawJobId]
    );
    
    return {
      success: true,
      objectId: job.objectId,
      thawJobId: job.thawJobId,
      isRetry: true
    };
  }
  
  return {
    success: false,
    error: 'Invalid job status for processing'
  };
}

export async function advanceThawProgress(thawJobId: string): Promise<ProcessingResult> {
  const row = await queryOne<any>(
    `SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`,
    [thawJobId]
  );
  
  if (!row) {
    return {
      success: false,
      error: 'Thaw job not found'
    };
  }
  
  const job = mapRowToThawJob(row);
  
  if (job.status !== ThawJobStatus.RESTORING) {
    return {
      success: false,
      error: `Job is not in RESTORING status (current: ${job.status})`
    };
  }
  
  const retrievalTime = RETRIEVAL_TIME_BY_TIER[job.retrievalTier];
  const progressIncrement = Math.floor(100 / retrievalTime);
  const newProgress = Math.min(100, (job.progress || 0) + progressIncrement);
  
  try {
    if (newProgress >= 100) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + job.thawDays * 24 * 60 * 60 * 1000);
      
      await runSql(
        `UPDATE thaw_jobs SET 
          status = ?, 
          progress = ?,
          completed_at = ?,
          expires_at = ?
        WHERE thaw_job_id = ?`,
        [ThawJobStatus.COMPLETED, 100, now.toISOString(), expiresAt.toISOString(), thawJobId]
      );
      
      const object = await getObjectById(job.objectId);
      if (object) {
        await logOperation({
          operation: 'THAW_COMPLETE',
          objectId: job.objectId,
          bucketName: object.bucketName,
          objectKey: object.objectKey,
          requestId: uuidv4(),
          userId: 'system',
          status: 'success',
          details: `Thaw completed, available until ${expiresAt.toISOString()}`
        });
      }
      
      return {
        success: true,
        objectId: job.objectId,
        thawJobId: job.thawJobId,
        status: StorageClass.STANDARD
      };
    } else {
      await runSql(
        `UPDATE thaw_jobs SET progress = ? WHERE thaw_job_id = ?`,
        [newProgress, thawJobId]
      );
      
      return {
        success: true,
        objectId: job.objectId,
        thawJobId: job.thawJobId
      };
    }
  } catch (error: any) {
    await runSql(
      `UPDATE thaw_jobs SET 
        status = ?, 
        failure_reason = ? 
      WHERE thaw_job_id = ?`,
      [ThawJobStatus.FAILED, error.message, thawJobId]
    );
    
    return {
      success: false,
      error: error.message
    };
  }
}

export async function retryThawJob(thawJobId: string, requestId: string, userId: string): Promise<ProcessingResult> {
  const row = await queryOne<any>(
    `SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`,
    [thawJobId]
  );
  
  if (!row) {
    return {
      success: false,
      error: 'Thaw job not found'
    };
  }
  
  const job = mapRowToThawJob(row);
  
  if (job.status !== ThawJobStatus.FAILED) {
    return {
      success: false,
      error: `Only failed jobs can be retried (current: ${job.status})`
    };
  }
  
  const now = new Date();
  const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
  
  await runSql(
    `UPDATE thaw_jobs SET status = ? WHERE thaw_job_id = ?`,
    [ThawJobStatus.RETRY_PENDING, thawJobId]
  );
  
  const object = await getObjectById(job.objectId);
  if (object) {
    await logOperation({
      operation: 'THAW_RETRY',
      objectId: job.objectId,
      bucketName: object.bucketName,
      objectKey: object.objectKey,
      requestId,
      userId,
      status: 'success',
      details: `Manual retry scheduled for ${nextRetryAt.toISOString()}`
    });
  }
  
  return {
    success: true,
    objectId: job.objectId,
    thawJobId: job.thawJobId,
    retryAt: nextRetryAt.toISOString(),
    isRetry: true
  };
}

export async function expireThawJobs(): Promise<ProcessingResult[]> {
  const now = new Date().toISOString();
  
  const expiringJobs = await querySql<any>(
    `SELECT * FROM thaw_jobs WHERE status = ? AND expires_at < ?`,
    [ThawJobStatus.COMPLETED, now]
  );
  
  const results: ProcessingResult[] = [];
  
  for (const row of expiringJobs) {
    const job = mapRowToThawJob(row);
    
    await runSql(
      `UPDATE thaw_jobs SET status = ? WHERE thaw_job_id = ?`,
      [ThawJobStatus.EXPIRED, job.thawJobId]
    );
    
    await runSql(
      `UPDATE objects SET current_thaw_job_id = NULL WHERE object_id = ?`,
      [job.objectId]
    );
    
    const object = await getObjectById(job.objectId);
    if (object) {
      await logOperation({
        operation: 'THAW_EXPIRED',
        objectId: job.objectId,
        bucketName: object.bucketName,
        objectKey: object.objectKey,
        requestId: uuidv4(),
        userId: 'system',
        status: 'success',
        details: 'Thaw period expired, object returned to archive'
      });
    }
    
    results.push({
      success: true,
      objectId: job.objectId,
      thawJobId: job.thawJobId
    });
  }
  
  return results;
}

export async function markJobFailedAndRecordTask(
  job: ThawJob,
  reason: string,
  requestId: string
): Promise<void> {
  await runSql(
    `UPDATE thaw_jobs SET status = ?, failure_reason = ? WHERE thaw_job_id = ?`,
    [ThawJobStatus.FAILED, reason, job.thawJobId]
  );
  
  const taskData = JSON.stringify({
    thawJobId: job.thawJobId,
    objectId: job.objectId,
    retrievalTier: job.retrievalTier,
    thawDays: job.thawDays
  });
  
  const now = new Date();
  const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
  
  await runSql(
    `INSERT INTO failed_tasks (
      task_id, task_type, object_id, failure_reason,
      failed_at, retry_count, max_retries, next_retry_at, task_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      'THAW',
      job.objectId,
      reason,
      now.toISOString(),
      0,
      5,
      nextRetryAt.toISOString(),
      taskData
    ]
  );
}

function mapRowToThawJob(row: any): ThawJob {
  return {
    thawJobId: row.thaw_job_id,
    objectId: row.object_id,
    objectKey: row.object_key,
    bucketName: row.bucket_name,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status as ThawJobStatus,
    thawDays: row.thaw_days,
    retrievalTier: row.retrieval_tier as 'expedited' | 'standard' | 'bulk',
    progress: row.progress,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    maxRetries: row.max_retries
  };
}
