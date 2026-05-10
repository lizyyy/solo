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
  body('name').notEmpty().withMessage('项目名称不能为空'),
  body('code').notEmpty().withMessage('项目编号不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { name, code, description, deadline } = req.body;

    const existingProject = await prisma.project.findUnique({ where: { code } });
    if (existingProject) {
      return res.status(409).json({ error: '项目编号已存在' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        code,
        description,
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    await createAuditLog({
      action: 'CREATE',
      entityType: 'Project',
      entityId: project.id,
      userName: 'system',
      remarks: '创建项目',
      projectId: project.id,
      afterState: project,
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: '创建项目失败', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: {
            sections: true,
            questions: true,
            clarifications: true,
            addendums: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

router.get('/:id', [
  param('id').notEmpty().withMessage('项目ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        sections: true,
        _count: {
          select: {
            questions: true,
            clarifications: true,
            addendums: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: '获取项目详情失败' });
  }
});

router.put('/:id', [
  param('id').notEmpty().withMessage('项目ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, description, deadline, status } = req.body;

    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
    if (status !== undefined) updateData.status = status;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Project',
      entityId: project.id,
      userName: 'system',
      remarks: '更新项目信息',
      projectId: project.id,
      beforeState: existingProject,
      afterState: project,
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: '更新项目失败' });
  }
});

router.delete('/:id', [
  param('id').notEmpty().withMessage('项目ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return res.status(404).json({ error: '项目不存在' });
    }

    await prisma.project.delete({ where: { id } });

    await createAuditLog({
      action: 'DELETE',
      entityType: 'Project',
      entityId: id,
      userName: 'system',
      remarks: '删除项目',
      beforeState: existingProject,
    });

    res.json({ message: '项目已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除项目失败' });
  }
});

router.post('/:projectId/sections', [
  param('projectId').notEmpty().withMessage('项目ID不能为空'),
  body('name').notEmpty().withMessage('标段名称不能为空'),
  body('code').notEmpty().withMessage('标段编号不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const { name, code, description } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const existingSection = await prisma.section.findFirst({
      where: { projectId, code },
    });
    if (existingSection) {
      return res.status(409).json({ error: '标段编号已存在' });
    }

    const section = await prisma.section.create({
      data: {
        projectId,
        name,
        code,
        description,
      },
    });

    await createAuditLog({
      action: 'CREATE',
      entityType: 'Section',
      entityId: section.id,
      userName: 'system',
      remarks: '创建标段',
      projectId,
      afterState: section,
    });

    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ error: '创建标段失败' });
  }
});

router.get('/:projectId/sections', [
  param('projectId').notEmpty().withMessage('项目ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;

    const sections = await prisma.section.findMany({
      where: { projectId },
      include: {
        _count: {
          select: {
            questions: true,
            clarifications: true,
            addendums: true,
            confirmations: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: '获取标段列表失败' });
  }
});

export default router;
