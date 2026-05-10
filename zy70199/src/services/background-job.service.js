const { models, JobStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/error-handler');
const AuditService = require('./audit.service');

class BackgroundJobService {
  static createJob(jobType, payload, options = {}) {
    const job = models.BackgroundJob.create({
      jobType,
      payload,
      priority: options.priority || 'NORMAL',
      maxAttempts: options.maxAttempts || 3,
      scheduledAt: options.scheduledAt || new Date().toISOString(),
      createdBy: options.createdBy || 'system'
    });
    
    AuditService.log('JOB_CREATED', 'BackgroundJob', job.id, options.createdBy || 'system', {
      jobType,
      scheduledAt: job.scheduledAt
    });
    
    logger.info(`Created background job ${job.id} of type ${jobType}`);
    return job;
  }

  static getJob(id) {
    const job = models.BackgroundJob.findById(id);
    if (!job) {
      throw new NotFoundError(`后台任务不存在: ${id}`);
    }
    return job;
  }

  static getPendingJobs() {
    return models.BackgroundJob.find(j => 
      j.status === JobStatus.PENDING && 
      new Date(j.scheduledAt) <= new Date()
    ).sort((a, b) => {
      const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });
  }

  static executeJob(jobId, executor) {
    const job = this.getJob(jobId);
    
    if (job.status === JobStatus.SUCCESS) {
      logger.warn(`Job ${jobId} already completed successfully`);
      return { status: 'ALREADY_COMPLETED', job };
    }
    
    if (job.attempts >= job.maxAttempts) {
      logger.error(`Job ${jobId} has exceeded max attempts (${job.maxAttempts})`);
      return { status: 'MAX_ATTEMPTS_EXCEEDED', job };
    }
    
    models.BackgroundJob.update(jobId, {
      status: JobStatus.RUNNING,
      startedAt: new Date().toISOString(),
      attempts: job.attempts + 1
    });
    
    logger.info(`Executing job ${jobId} (attempt ${job.attempts + 1}/${job.maxAttempts})`);
    
    try {
      const result = executor(job.payload);
      
      models.BackgroundJob.update(jobId, {
        status: JobStatus.SUCCESS,
        completedAt: new Date().toISOString(),
        result: typeof result === 'string' ? result : JSON.stringify(result)
      });
      
      AuditService.log('JOB_SUCCESS', 'BackgroundJob', jobId, 'system', {
        jobType: job.jobType,
        attempt: job.attempts + 1
      });
      
      logger.info(`Job ${jobId} completed successfully`);
      return { status: 'SUCCESS', job, result };
      
    } catch (error) {
      const currentAttempts = job.attempts + 1;
      const shouldRetry = currentAttempts < job.maxAttempts;
      
      const newStatus = shouldRetry ? JobStatus.RETRYING : JobStatus.FAILED;
      
      models.BackgroundJob.update(jobId, {
        status: newStatus,
        completedAt: !shouldRetry ? new Date().toISOString() : null,
        error: error.message,
        errorStack: error.stack
      });
      
      AuditService.log('JOB_FAILED', 'BackgroundJob', jobId, 'system', {
        jobType: job.jobType,
        attempt: currentAttempts,
        willRetry: shouldRetry,
        error: error.message
      });
      
      logger.error(`Job ${jobId} failed (attempt ${currentAttempts}/${job.maxAttempts}): ${error.message}`);
      
      if (shouldRetry) {
        logger.info(`Job ${jobId} will be retried`);
        return { 
          status: 'FAILED_WILL_RETRY', 
          job: models.BackgroundJob.findById(jobId), 
          error: error.message,
          nextAttempt: currentAttempts + 1
        };
      } else {
        logger.error(`Job ${jobId} has failed permanently after ${currentAttempts} attempts`);
        return { 
          status: 'FAILED_PERMANENTLY', 
          job: models.BackgroundJob.findById(jobId), 
          error: error.message
        };
      }
    }
  }

  static retryJob(jobId) {
    const job = this.getJob(jobId);
    
    if (job.status === JobStatus.SUCCESS) {
      return { status: 'ALREADY_COMPLETED', job };
    }
    
    if (job.attempts >= job.maxAttempts) {
      models.BackgroundJob.update(jobId, {
        status: JobStatus.PENDING,
        attempts: 0,
        error: null,
        scheduledAt: new Date().toISOString()
      });
      
      AuditService.log('JOB_RETRY_FORCED', 'BackgroundJob', jobId, 'system', {
        jobType: job.jobType,
        previousAttempts: job.attempts
      });
      
      logger.info(`Job ${jobId} reset for retry`);
      return { status: 'RESET_FOR_RETRY', job: models.BackgroundJob.findById(jobId) };
    }
    
    models.BackgroundJob.update(jobId, {
      status: JobStatus.PENDING,
      scheduledAt: new Date().toISOString()
    });
    
    logger.info(`Job ${jobId} scheduled for retry`);
    return { status: 'SCHEDULED_FOR_RETRY', job: models.BackgroundJob.findById(jobId) };
  }

  static cancelJob(jobId, reason, userId = 'admin') {
    const job = this.getJob(jobId);
    
    if (job.status === JobStatus.SUCCESS || job.status === JobStatus.FAILED) {
      return { status: 'ALREADY_COMPLETED', job };
    }
    
    models.BackgroundJob.update(jobId, {
      status: JobStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      cancellationReason: reason
    });
    
    AuditService.log('JOB_CANCELLED', 'BackgroundJob', jobId, userId, {
      jobType: job.jobType,
      reason
    });
    
    logger.info(`Job ${jobId} cancelled by ${userId}: ${reason}`);
    return { status: 'CANCELLED', job: models.BackgroundJob.findById(jobId) };
  }

  static getJobStatus(jobId) {
    const job = this.getJob(jobId);
    
    return {
      id: job.id,
      type: job.jobType,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      canRetry: job.status === JobStatus.FAILED || job.status === JobStatus.RETRYING,
      isComplete: job.status === JobStatus.SUCCESS || job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED
    };
  }
}

const jobExecutors = {
  'NOTIFY_REMEDIATION': (payload) => {
    logger.info(`Sending remediation notification to ${payload.employeeName} for: ${payload.documentName}`);
    return { notificationSent: true };
  },
  
  'CHECK_DOCUMENT_COMPLETION': (payload) => {
    logger.info(`Checking document completion for employee ${payload.employeeId}`);
    return { checked: true, employeeId: payload.employeeId };
  },
  
  'GENERATE_CONTRACT': (payload) => {
    logger.info(`Generating contract for employee ${payload.employeeId}`);
    return { contractGenerated: true, employeeId: payload.employeeId };
  },
  
  'CREATE_ACCOUNT': (payload) => {
    logger.info(`Creating account for employee ${payload.employeeId}`);
    return { accountCreated: true, employeeId: payload.employeeId };
  },
  
  'GENERATE_REPORT': (payload) => {
    logger.info(`Generating report: ${payload.reportType}`);
    return { reportGenerated: true, type: payload.reportType };
  },
  
  'SEND_REMINDER': (payload) => {
    if (payload.shouldFail) {
      throw new Error('模拟提醒发送失败');
    }
    logger.info(`Sending reminder to ${payload.recipient}`);
    return { reminderSent: true };
  }
};

module.exports = {
  BackgroundJobService,
  jobExecutors
};
