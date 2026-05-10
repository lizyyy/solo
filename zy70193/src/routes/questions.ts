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

router.post('/suppliers', [
  body('name').notEmpty().withMessage('供应商名称不能为空'),
  body('code').notEmpty().withMessage('供应商编号不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { name, code, contact, email, phone } = req.body;

    const existingSupplier = await prisma.supplier.findUnique({ where: { code } });
    if (existingSupplier) {
      return res.status(409).json({ error: '供应商编号已存在' });
    }

    const supplier = await prisma.supplier.create({
      data: { name, code, contact, email, phone },
    });

    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: '创建供应商失败' });
  }
});

router.get('/suppliers', async (_req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            confirmations: true,
          },
        },
      },
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: '获取供应商列表失败' });
  }
});

router.post('/', [
  body('projectId').notEmpty().withMessage('项目ID不能为空'),
  body('supplierId').notEmpty().withMessage('供应商ID不能为空'),
  body('title').notEmpty().withMessage('问题标题不能为空'),
  body('content').notEmpty().withMessage('问题内容不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId, supplierId, title, content } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    if (sectionId) {
      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section || section.projectId !== projectId) {
        return res.status(404).json({ error: '标段不存在或不属于该项目' });
      }
    }

    const question = await prisma.question.create({
      data: {
        projectId,
        sectionId: sectionId || null,
        supplierId,
        title,
        content,
        status: 'pending',
      },
      include: {
        supplier: true,
        section: true,
      },
    });

    await createAuditLog({
      action: 'CREATE',
      entityType: 'Question',
      entityId: question.id,
      userName: supplier.name,
      remarks: '供应商提交问题',
      projectId,
      questionId: question.id,
      afterState: question,
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: '提交问题失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId, supplierId, status } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (sectionId) where.sectionId = sectionId as string;
    if (supplierId) where.supplierId = supplierId as string;
    if (status) where.status = status as string;

    const questions = await prisma.question.findMany({
      where,
      include: {
        supplier: true,
        section: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: '获取问题列表失败' });
  }
});

router.get('/:id', [
  param('id').notEmpty().withMessage('问题ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        supplier: true,
        section: true,
        project: true,
        clarificationItems: {
          include: {
            clarification: true,
          },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: '问题不存在' });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: '获取问题详情失败' });
  }
});

router.post('/:id/answer', [
  param('id').notEmpty().withMessage('问题ID不能为空'),
  body('answer').notEmpty().withMessage('答复内容不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { answer, answeredBy = 'admin' } = req.body;

    const existingQuestion = await prisma.question.findUnique({ where: { id } });
    if (!existingQuestion) {
      return res.status(404).json({ error: '问题不存在' });
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        answer,
        status: 'answered',
        answeredAt: new Date(),
        answeredBy,
      },
      include: {
        supplier: true,
        section: true,
      },
    });

    await createAuditLog({
      action: 'ANSWER',
      entityType: 'Question',
      entityId: question.id,
      userName: answeredBy,
      remarks: '答复问题',
      projectId: question.projectId,
      questionId: question.id,
      beforeState: existingQuestion,
      afterState: question,
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: '答复问题失败' });
  }
});

router.put('/:id/status', [
  param('id').notEmpty().withMessage('问题ID不能为空'),
  body('status').notEmpty().withMessage('状态不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['pending', 'reviewing', 'answered', 'published', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const existingQuestion = await prisma.question.findUnique({ where: { id } });
    if (!existingQuestion) {
      return res.status(404).json({ error: '问题不存在' });
    }

    const question = await prisma.question.update({
      where: { id },
      data: { status },
    });

    await createAuditLog({
      action: 'STATUS_CHANGE',
      entityType: 'Question',
      entityId: question.id,
      userName: 'admin',
      remarks: `状态变更: ${existingQuestion.status} -> ${status}`,
      projectId: question.projectId,
      questionId: question.id,
      beforeState: existingQuestion,
      afterState: question,
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: '更新问题状态失败' });
  }
});

export default router;
