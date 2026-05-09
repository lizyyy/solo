const express = require('express');
const { ApiResponse } = require('../utils/response');
const OperationLogService = require('../services/operationLogService');
const BackgroundJobService = require('../services/backgroundJobService');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/operations', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const { 
      operator_id, operation_type, target_type, target_id,
      start_date, end_date,
      page = 1, page_size = 20 
    } = req.query;

    const result = await OperationLogService.getLogs(
      {
        operatorId: operator_id,
        operationType: operation_type,
        targetType: target_type,
        targetId: target_id,
        startDate: start_date,
        endDate: end_date
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.logs, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/operations/history/:targetType/:targetId', authenticate, async (req, res, next) => {
  try {
    const { targetType, targetId } = req.params;
    const history = await OperationLogService.getItemHistory(targetType, targetId);
    res.json(ApiResponse.success(history));
  } catch (error) {
    next(error);
  }
});

router.get('/jobs', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const { 
      job_type, status,
      page = 1, page_size = 20 
    } = req.query;

    const result = await BackgroundJobService.listJobs(
      {
        job_type,
        status
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.jobs, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/stats', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const stats = await BackgroundJobService.getJobStats();
    res.json(ApiResponse.success(stats));
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId', authenticate, async (req, res, next) => {
  try {
    const job = await BackgroundJobService.getJobStatus(req.params.jobId);
    res.json(ApiResponse.success(job));
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/retry/:jobId', authenticate, requireRoles('supervisor', 'admin'), async (req, res, next) => {
  try {
    const result = await BackgroundJobService.retryJob(req.params.jobId);
    res.json(ApiResponse.success(result, '任务已重新加入队列'));
  } catch (error) {
    next(error);
  }
});

router.post('/jobs/retry-all', authenticate, requireRoles('admin'), async (req, res, next) => {
  try {
    const { job_type } = req.body;
    const result = await BackgroundJobService.retryFailedJobs(job_type);
    res.json(ApiResponse.success(result, `已重试 ${result.retried_count} 个失败任务`));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
