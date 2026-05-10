import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import prisma from '../prisma';
import { getAuditLogsByEntity, getAuditLogsByProject } from '../services/auditService';
import { executeJob, retryJob, getJobById, getJobsByType, executePendingJobs } from '../services/jobService';

const router = Router();

const validateRequest = (req: Request, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/audit', [
  query('entityType').optional(),
  query('entityId').optional(),
  query('projectId').optional(),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, projectId } = req.query;

    if (entityType && entityId) {
      const logs = await getAuditLogsByEntity(entityType as string, entityId as string);
      return res.json(logs);
    }

    if (projectId) {
      const logs = await getAuditLogsByProject(projectId as string);
      return res.json(logs);
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: '获取审计日志失败' });
  }
});

router.get('/jobs', [
  query('type').optional(),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let jobs;
    if (type) {
      jobs = await getJobsByType(type as string);
    } else {
      jobs = await prisma.backgroundJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

router.get('/jobs/:id', [
  param('id').notEmpty().withMessage('任务ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const job = await getJobById(id);
    if (!job) {
      return res.status(404).json({ error: '任务不存在' });
    }

    res.json(job);
  } catch (error) {
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

router.post('/jobs/:id/execute', [
  param('id').notEmpty().withMessage('任务ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const result = await executeJob(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: '执行任务失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/jobs/:id/retry', [
  param('id').notEmpty().withMessage('任务ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const job = await retryJob(id);
    res.json({
      message: '任务已重置，可以重新执行',
      job,
    });
  } catch (error) {
    res.status(400).json({
      error: '重试任务失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/jobs/execute-all', async (_req: Request, res: Response) => {
  try {
    const results = await executePendingJobs();
    res.json({
      total: results.length,
      results,
    });
  } catch (error) {
    res.status(500).json({
      error: '执行待处理任务失败',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/jobs/pending', async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.backgroundJob.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const failedCount = jobs.filter(j => j.status === 'failed').length;
    const pendingCount = jobs.filter(j => j.status === 'pending').length;
    const canRetry = jobs.filter(j => j.retryCount < j.maxRetries).length;

    res.json({
      summary: {
        totalPending: jobs.length,
        pending: pendingCount,
        failed: failedCount,
        canRetry,
      },
      jobs,
    });
  } catch (error) {
    res.status(500).json({ error: '获取待处理任务失败' });
  }
});

router.get('/statistics', async (_req: Request, res: Response) => {
  try {
    const [
      projectsCount,
      questionsCount,
      answeredCount,
      clarificationsCount,
      addendumsCount,
      suppliersCount,
      jobsCount,
      failedJobsCount,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.question.count(),
      prisma.question.count({ where: { status: { in: ['answered', 'published'] } } }),
      prisma.clarification.count({ where: { status: 'published' } }),
      prisma.addendum.count(),
      prisma.supplier.count(),
      prisma.backgroundJob.count(),
      prisma.backgroundJob.count({ where: { status: 'failed' } }),
    ]);

    const pendingQuestions = questionsCount - answeredCount;
    const answerRate = questionsCount > 0 ? ((answeredCount / questionsCount) * 100).toFixed(2) + '%' : '0%';

    res.json({
      projects: { total: projectsCount },
      questions: {
        total: questionsCount,
        answered: answeredCount,
        pending: pendingQuestions,
        answerRate,
      },
      clarifications: { published: clarificationsCount },
      addendums: { total: addendumsCount },
      suppliers: { total: suppliersCount },
      jobs: {
        total: jobsCount,
        failed: failedJobsCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

export default router;
