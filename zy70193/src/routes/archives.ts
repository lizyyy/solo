import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../prisma';
import { createAuditLog } from '../services/auditService';
import { createBackgroundJob, registerJobHandler, BackgroundJobPayload, JobExecutionResult } from '../services/jobService';

const router = Router();

const validateRequest = (req: Request, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function generateArchiveReportHandler(payload: BackgroundJobPayload, _jobId: string): Promise<JobExecutionResult> {
  const { projectId, archiveId } = payload;

  if (!projectId || !archiveId) {
    return { success: false, error: '缺少必要参数' };
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      include: {
        sections: {
          include: {
            questions: {
              include: {
                supplier: true,
                clarificationItems: {
                  include: {
                    clarification: true,
                  },
                },
              },
            },
            clarifications: {
              include: {
                items: {
                  include: {
                    question: {
                      include: { supplier: true },
                    },
                  },
                },
              },
            },
            addendums: {
              include: {
                confirmations: {
                  include: { supplier: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return { success: false, error: '项目不存在' };
    }

    const sectionsSummary = project.sections.map(section => ({
      sectionId: section.id,
      sectionName: section.name,
      sectionCode: section.code,
      questionsCount: section.questions.length,
      clarificationsCount: section.clarifications.length,
      addendumsCount: section.addendums.length,
      questions: section.questions.map(q => ({
        questionId: q.id,
        supplierName: q.supplier.name,
        title: q.title,
        status: q.status,
        createdAt: q.createdAt,
        answeredAt: q.answeredAt,
        clarificationVersions: q.clarificationItems.map(ci => ci.clarification.version),
      })),
      clarifications: section.clarifications.map(c => ({
        clarificationId: c.id,
        version: c.version,
        title: c.title,
        status: c.status,
        publishDate: c.publishDate,
        itemsCount: c.items.length,
        items: c.items.map(item => ({
          questionId: item.questionId,
          supplierName: item.question.supplier.name,
          questionTitle: item.question.title,
          answer: item.answer,
        })),
      })),
      addendums: section.addendums.map(a => ({
        addendumId: a.id,
        title: a.title,
        fileName: a.fileName,
        createdAt: a.createdAt,
        confirmations: a.confirmations.map(conf => ({
          supplierName: conf.supplier.name,
          confirmed: conf.confirmed,
          confirmedAt: conf.confirmedAt,
        })),
        confirmedCount: a.confirmations.filter(c => c.confirmed).length,
        totalCount: a.confirmations.length,
      })),
    }));

    const totalQuestions = sectionsSummary.reduce((sum, s) => sum + s.questionsCount, 0);
    const totalAnswered = sectionsSummary.reduce((sum, s) => sum + s.questions.filter(q => q.status === 'answered' || q.status === 'published').length, 0);
    const totalClarifications = sectionsSummary.reduce((sum, s) => sum + s.clarificationsCount, 0);
    const totalAddendums = sectionsSummary.reduce((sum, s) => sum + s.addendumsCount, 0);

    const reportContent = {
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        createdAt: project.createdAt,
      },
      summary: {
        totalSections: project.sections.length,
        totalQuestions,
        totalAnswered,
        answerRate: totalQuestions > 0 ? ((totalAnswered / totalQuestions) * 100).toFixed(2) + '%' : '0%',
        totalClarifications,
        totalAddendums,
        generatedAt: new Date().toISOString(),
      },
      sections: sectionsSummary,
    };

    await prisma.archiveReport.update({
      where: { id: archiveId as string },
      data: {
        status: 'completed',
        content: JSON.stringify(reportContent, null, 2),
      },
    });

    await createAuditLog({
      action: 'GENERATE',
      entityType: 'ArchiveReport',
      entityId: archiveId as string,
      userName: 'system',
      remarks: '归档报告生成完成',
      projectId: projectId as string,
      archiveId: archiveId as string,
    });

    return {
      success: true,
      result: {
        archiveId,
        summary: reportContent.summary,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.archiveReport.update({
      where: { id: archiveId as string },
      data: {
        status: 'failed',
        errorMessage,
      },
    });
    return { success: false, error: errorMessage };
  }
}

registerJobHandler('GENERATE_ARCHIVE_REPORT', generateArchiveReportHandler);

router.post('/', [
  body('projectId').notEmpty().withMessage('项目ID不能为空'),
  body('title').notEmpty().withMessage('报告标题不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { projectId, title, generatedBy = 'admin' } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const archive = await prisma.archiveReport.create({
      data: {
        projectId,
        title,
        content: '',
        status: 'generating',
        generatedBy,
      },
    });

    await createBackgroundJob('GENERATE_ARCHIVE_REPORT', {
      projectId,
      archiveId: archive.id,
    }, 3);

    await createAuditLog({
      action: 'CREATE',
      entityType: 'ArchiveReport',
      entityId: archive.id,
      userName: generatedBy,
      remarks: '创建归档报告任务',
      projectId,
      archiveId: archive.id,
      afterState: archive,
    });

    res.status(201).json({
      ...archive,
      message: '归档报告生成任务已创建，请查询任务状态或稍后获取报告',
    });
  } catch (error) {
    res.status(500).json({ error: '创建归档报告失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;

    const archives = await prisma.archiveReport.findMany({
      where,
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(archives);
  } catch (error) {
    res.status(500).json({ error: '获取归档列表失败' });
  }
});

router.get('/:id', [
  param('id').notEmpty().withMessage('归档ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const archive = await prisma.archiveReport.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            sections: true,
          },
        },
      },
    });

    if (!archive) {
      return res.status(404).json({ error: '归档报告不存在' });
    }

    let parsedContent = null;
    if (archive.content) {
      try {
        parsedContent = JSON.parse(archive.content);
      } catch {
        parsedContent = archive.content;
      }
    }

    res.json({
      ...archive,
      parsedContent,
    });
  } catch (error) {
    res.status(500).json({ error: '获取归档详情失败' });
  }
});

router.get('/:id/export', [
  param('id').notEmpty().withMessage('归档ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const archive = await prisma.archiveReport.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!archive) {
      return res.status(404).json({ error: '归档报告不存在' });
    }

    if (archive.status !== 'completed') {
      return res.status(400).json({ error: '归档报告尚未生成完成' });
    }

    let content: unknown;
    try {
      content = JSON.parse(archive.content);
    } catch {
      content = archive.content;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="archive-report-${id}.json"`);
    res.json({
      archiveId: id,
      title: archive.title,
      project: archive.project.name,
      exportedAt: new Date().toISOString(),
      content,
    });
  } catch (error) {
    res.status(500).json({ error: '导出归档报告失败' });
  }
});

router.post('/:id/retry', [
  param('id').notEmpty().withMessage('归档ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const archive = await prisma.archiveReport.findUnique({ where: { id } });
    if (!archive) {
      return res.status(404).json({ error: '归档报告不存在' });
    }

    if (archive.status === 'completed') {
      return res.status(400).json({ error: '归档报告已完成，无需重试' });
    }

    await prisma.archiveReport.update({
      where: { id },
      data: {
        status: 'generating',
        errorMessage: null,
      },
    });

    const job = await createBackgroundJob('GENERATE_ARCHIVE_REPORT', {
      projectId: archive.projectId,
      archiveId: archive.id,
    }, 3);

    await createAuditLog({
      action: 'RETRY',
      entityType: 'ArchiveReport',
      entityId: id,
      userName: 'admin',
      remarks: `重试生成归档报告，任务ID: ${job.id}`,
      projectId: archive.projectId,
      archiveId: id,
    });

    res.json({
      message: '已创建重试任务',
      jobId: job.id,
      archiveId: id,
    });
  } catch (error) {
    res.status(500).json({ error: '重试归档报告失败' });
  }
});

export default router;
