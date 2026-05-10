"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createThawJob = createThawJob;
exports.getThawJobById = getThawJobById;
exports.getThawJobsByObject = getThawJobsByObject;
exports.processPendingThawJobs = processPendingThawJobs;
exports.advanceThawProgress = advanceThawProgress;
exports.retryThawJob = retryThawJob;
exports.expireThawJobs = expireThawJobs;
exports.markJobFailedAndRecordTask = markJobFailedAndRecordTask;
const uuid_1 = require("uuid");
const types_1 = require("../models/types");
const index_1 = require("../database/index");
const lifecycleService_1 = require("./lifecycleService");
const costService_1 = require("./costService");
const loggingService_1 = require("./loggingService");
const RETRIEVAL_TIME_BY_TIER = {
    'expedited': 1,
    'standard': 5,
    'bulk': 12
};
async function createThawJob(params) {
    const object = await (0, lifecycleService_1.getObjectById)(params.objectId);
    if (!object) {
        return {
            success: false,
            error: 'Object not found'
        };
    }
    if (object.storageClass !== types_1.StorageClass.ARCHIVE &&
        object.storageClass !== types_1.StorageClass.DEEP_ARCHIVE) {
        return {
            success: false,
            error: `Object is not in archive storage class (current: ${object.storageClass})`,
            warnings: ['Object does not need thawing']
        };
    }
    if (object.currentThawJobId) {
        const existingJob = await getThawJobById(object.currentThawJobId);
        if (existingJob &&
            (existingJob.status === types_1.ThawJobStatus.PENDING ||
                existingJob.status === types_1.ThawJobStatus.RESTORING)) {
            return {
                success: false,
                error: 'Object already has an active thaw job',
                thawJobId: existingJob.thawJobId
            };
        }
    }
    const costEstimate = (0, costService_1.estimateRetrievalCost)(object.objectId, object.objectKey, object.size, object.storageClass, params.retrievalTier);
    const thawJobId = (0, uuid_1.v4)();
    const now = new Date();
    const job = {
        thawJobId,
        objectId: params.objectId,
        objectKey: object.objectKey,
        bucketName: object.bucketName,
        requestedBy: params.requestedBy,
        requestedAt: now.toISOString(),
        status: types_1.ThawJobStatus.PENDING,
        thawDays: params.thawDays,
        retrievalTier: params.retrievalTier,
        progress: 0,
        retryCount: 0,
        maxRetries: 3
    };
    try {
        await (0, index_1.runSql)(`INSERT INTO thaw_jobs (
        thaw_job_id, object_id, object_key, bucket_name, requested_by,
        requested_at, status, thaw_days, retrieval_tier, progress,
        retry_count, max_retries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        await (0, index_1.runSql)(`UPDATE objects SET current_thaw_job_id = ? WHERE object_id = ?`, [job.thawJobId, params.objectId]);
        const logId = await (0, loggingService_1.logOperation)({
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
    }
    catch (error) {
        const logId = await (0, loggingService_1.logOperation)({
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
async function getThawJobById(thawJobId) {
    const row = await (0, index_1.queryOne)(`SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`, [thawJobId]);
    if (!row)
        return undefined;
    return mapRowToThawJob(row);
}
async function getThawJobsByObject(objectId) {
    const rows = await (0, index_1.querySql)(`SELECT * FROM thaw_jobs WHERE object_id = ? ORDER BY requested_at DESC`, [objectId]);
    return rows.map(mapRowToThawJob);
}
async function processPendingThawJobs() {
    const pendingJobs = await (0, index_1.querySql)(`SELECT * FROM thaw_jobs WHERE status IN (?, ?) ORDER BY requested_at ASC`, [types_1.ThawJobStatus.PENDING, types_1.ThawJobStatus.RETRY_PENDING]);
    const results = [];
    for (const row of pendingJobs) {
        const job = mapRowToThawJob(row);
        const result = await processThawJob(job);
        results.push(result);
    }
    return results;
}
async function processThawJob(job) {
    const object = await (0, lifecycleService_1.getObjectById)(job.objectId);
    if (!object) {
        return {
            success: false,
            error: 'Object not found'
        };
    }
    if (job.status === types_1.ThawJobStatus.PENDING) {
        await (0, index_1.runSql)(`UPDATE thaw_jobs SET status = ?, started_at = ?, progress = ? WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.RESTORING, new Date().toISOString(), 10, job.thawJobId]);
        return {
            success: true,
            objectId: job.objectId,
            thawJobId: job.thawJobId
        };
    }
    if (job.status === types_1.ThawJobStatus.RETRY_PENDING) {
        const newRetryCount = job.retryCount + 1;
        if (newRetryCount > job.maxRetries) {
            await (0, index_1.runSql)(`UPDATE thaw_jobs SET status = ?, failure_reason = ? WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.FAILED, 'Max retries exceeded', job.thawJobId]);
            return {
                success: false,
                objectId: job.objectId,
                thawJobId: job.thawJobId,
                error: 'Max retries exceeded'
            };
        }
        await (0, index_1.runSql)(`UPDATE thaw_jobs SET 
        status = ?, 
        started_at = ?, 
        progress = ?,
        retry_count = ?,
        failure_reason = NULL
      WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.RESTORING, new Date().toISOString(), 10, newRetryCount, job.thawJobId]);
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
async function advanceThawProgress(thawJobId) {
    const row = await (0, index_1.queryOne)(`SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`, [thawJobId]);
    if (!row) {
        return {
            success: false,
            error: 'Thaw job not found'
        };
    }
    const job = mapRowToThawJob(row);
    if (job.status !== types_1.ThawJobStatus.RESTORING) {
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
            await (0, index_1.runSql)(`UPDATE thaw_jobs SET 
          status = ?, 
          progress = ?,
          completed_at = ?,
          expires_at = ?
        WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.COMPLETED, 100, now.toISOString(), expiresAt.toISOString(), thawJobId]);
            const object = await (0, lifecycleService_1.getObjectById)(job.objectId);
            if (object) {
                await (0, loggingService_1.logOperation)({
                    operation: 'THAW_COMPLETE',
                    objectId: job.objectId,
                    bucketName: object.bucketName,
                    objectKey: object.objectKey,
                    requestId: (0, uuid_1.v4)(),
                    userId: 'system',
                    status: 'success',
                    details: `Thaw completed, available until ${expiresAt.toISOString()}`
                });
            }
            return {
                success: true,
                objectId: job.objectId,
                thawJobId: job.thawJobId,
                status: types_1.StorageClass.STANDARD
            };
        }
        else {
            await (0, index_1.runSql)(`UPDATE thaw_jobs SET progress = ? WHERE thaw_job_id = ?`, [newProgress, thawJobId]);
            return {
                success: true,
                objectId: job.objectId,
                thawJobId: job.thawJobId
            };
        }
    }
    catch (error) {
        await (0, index_1.runSql)(`UPDATE thaw_jobs SET 
        status = ?, 
        failure_reason = ? 
      WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.FAILED, error.message, thawJobId]);
        return {
            success: false,
            error: error.message
        };
    }
}
async function retryThawJob(thawJobId, requestId, userId) {
    const row = await (0, index_1.queryOne)(`SELECT * FROM thaw_jobs WHERE thaw_job_id = ?`, [thawJobId]);
    if (!row) {
        return {
            success: false,
            error: 'Thaw job not found'
        };
    }
    const job = mapRowToThawJob(row);
    if (job.status !== types_1.ThawJobStatus.FAILED) {
        return {
            success: false,
            error: `Only failed jobs can be retried (current: ${job.status})`
        };
    }
    const now = new Date();
    const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
    await (0, index_1.runSql)(`UPDATE thaw_jobs SET status = ? WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.RETRY_PENDING, thawJobId]);
    const object = await (0, lifecycleService_1.getObjectById)(job.objectId);
    if (object) {
        await (0, loggingService_1.logOperation)({
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
async function expireThawJobs() {
    const now = new Date().toISOString();
    const expiringJobs = await (0, index_1.querySql)(`SELECT * FROM thaw_jobs WHERE status = ? AND expires_at < ?`, [types_1.ThawJobStatus.COMPLETED, now]);
    const results = [];
    for (const row of expiringJobs) {
        const job = mapRowToThawJob(row);
        await (0, index_1.runSql)(`UPDATE thaw_jobs SET status = ? WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.EXPIRED, job.thawJobId]);
        await (0, index_1.runSql)(`UPDATE objects SET current_thaw_job_id = NULL WHERE object_id = ?`, [job.objectId]);
        const object = await (0, lifecycleService_1.getObjectById)(job.objectId);
        if (object) {
            await (0, loggingService_1.logOperation)({
                operation: 'THAW_EXPIRED',
                objectId: job.objectId,
                bucketName: object.bucketName,
                objectKey: object.objectKey,
                requestId: (0, uuid_1.v4)(),
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
async function markJobFailedAndRecordTask(job, reason, requestId) {
    await (0, index_1.runSql)(`UPDATE thaw_jobs SET status = ?, failure_reason = ? WHERE thaw_job_id = ?`, [types_1.ThawJobStatus.FAILED, reason, job.thawJobId]);
    const taskData = JSON.stringify({
        thawJobId: job.thawJobId,
        objectId: job.objectId,
        retrievalTier: job.retrievalTier,
        thawDays: job.thawDays
    });
    const now = new Date();
    const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
    await (0, index_1.runSql)(`INSERT INTO failed_tasks (
      task_id, task_type, object_id, failure_reason,
      failed_at, retry_count, max_retries, next_retry_at, task_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        (0, uuid_1.v4)(),
        'THAW',
        job.objectId,
        reason,
        now.toISOString(),
        0,
        5,
        nextRetryAt.toISOString(),
        taskData
    ]);
}
function mapRowToThawJob(row) {
    return {
        thawJobId: row.thaw_job_id,
        objectId: row.object_id,
        objectKey: row.object_key,
        bucketName: row.bucket_name,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        status: row.status,
        thawDays: row.thaw_days,
        retrievalTier: row.retrieval_tier,
        progress: row.progress,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        expiresAt: row.expires_at,
        failureReason: row.failure_reason,
        retryCount: row.retry_count,
        maxRetries: row.max_retries
    };
}
