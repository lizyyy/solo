import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../prisma';
import { createAuditLog } from '../services/auditService';

const router = Router();

const validateRequest = (req: Request, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/', [
  body('projectId').notEmpty().withMessage('项目ID不能为空'),
  body('title').notEmpty().withMessage('澄清标题不能为空'),
  body('content').notEmpty().withMessage('澄清内容不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId, title, content } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const latestClarification = await prisma.clarification.findFirst({
      where: { projectId, sectionId: sectionId || null },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestClarification ? latestClarification.version + 1 : 1;

    const clarification = await prisma.clarification.create({
      data: {
        projectId,
        sectionId: sectionId || null,
        version: nextVersion,
        title,
        content,
        status: 'draft',
      },
    });

    await createAuditLog({
      action: 'CREATE',
      entityType: 'Clarification',
      entityId: clarification.id,
      userName: 'admin',
      remarks: `创建澄清版本 v${nextVersion}`,
      projectId,
      clarificationId: clarification.id,
      afterState: clarification,
    });

    res.status(201).json(clarification);
  } catch (error) {
    res.status(500).json({ error: '创建澄清失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId, status } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (sectionId) where.sectionId = sectionId as string;
    if (status) where.status = status as string;

    const clarifications = await prisma.clarification.findMany({
      where,
      include: {
        section: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    res.json(clarifications);
  } catch (error) {
    res.status(500).json({ error: '获取澄清列表失败' });
  }
});

router.get('/:id', [
  param('id').notEmpty().withMessage('澄清ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const clarification = await prisma.clarification.findUnique({
      where: { id },
      include: {
        section: true,
        project: true,
        items: {
          include: {
            question: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
    });

    if (!clarification) {
      return res.status(404).json({ error: '澄清不存在' });
    }

    res.json(clarification);
  } catch (error) {
    res.status(500).json({ error: '获取澄清详情失败' });
  }
});

router.post('/:id/items', [
  param('id').notEmpty().withMessage('澄清ID不能为空'),
  body('questionId').notEmpty().withMessage('问题ID不能为空'),
  body('answer').notEmpty().withMessage('答复内容不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { questionId, answer } = req.body;

    const clarification = await prisma.clarification.findUnique({ where: { id } });
    if (!clarification) {
      return res.status(404).json({ error: '澄清不存在' });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return res.status(404).json({ error: '问题不存在' });
    }

    const existingItem = await prisma.clarificationItem.findFirst({
      where: { clarificationId: id, questionId },
    });
    if (existingItem) {
      return res.status(409).json({ error: '该问题已添加到此澄清中' });
    }

    const item = await prisma.clarificationItem.create({
      data: {
        clarificationId: id,
        questionId,
        answer,
      },
    });

    await prisma.question.update({
      where: { id: questionId },
      data: { status: 'published' },
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: '添加澄清项失败' });
  }
});

router.post('/:id/publish', [
  param('id').notEmpty().withMessage('澄清ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { publishedBy = 'admin' } = req.body;

    const existingClarification = await prisma.clarification.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingClarification) {
      return res.status(404).json({ error: '澄清不存在' });
    }

    if (existingClarification.items.length === 0) {
      return res.status(400).json({ error: '澄清中没有问题项，无法发布' });
    }

    const clarification = await prisma.clarification.update({
      where: { id },
      data: {
        status: 'published',
        publishDate: new Date(),
        publishedBy,
      },
    });

    await createAuditLog({
      action: 'PUBLISH',
      entityType: 'Clarification',
      entityId: clarification.id,
      userName: publishedBy,
      remarks: `发布澄清版本 v${clarification.version}`,
      projectId: clarification.projectId,
      clarificationId: clarification.id,
      beforeState: existingClarification,
      afterState: clarification,
    });

    res.json(clarification);
  } catch (error) {
    res.status(500).json({ error: '发布澄清失败' });
  }
});

router.put('/:id', [
  param('id').notEmpty().withMessage('澄清ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, content } = req.body;

    const existingClarification = await prisma.clarification.findUnique({ where: { id } });
    if (!existingClarification) {
      return res.status(404).json({ error: '澄清不存在' });
    }

    if (existingClarification.status === 'published') {
      return res.status(400).json({ error: '已发布的澄清不能修改，请创建新版本' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    const clarification = await prisma.clarification.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Clarification',
      entityId: clarification.id,
      userName: 'admin',
      remarks: '更新澄清内容',
      projectId: clarification.projectId,
      clarificationId: clarification.id,
      beforeState: existingClarification,
      afterState: clarification,
    });

    res.json(clarification);
  } catch (error) {
    res.status(500).json({ error: '更新澄清失败' });
  }
});

export default router;
