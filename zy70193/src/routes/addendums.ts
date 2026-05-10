import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { createAuditLog } from '../services/auditService';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

const validateRequest = (req: Request, res: Response, next: () => void) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/', upload.single('file'), [
  body('projectId').notEmpty().withMessage('项目ID不能为空'),
  body('title').notEmpty().withMessage('补遗标题不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId, title, description, uploadedBy = 'admin' } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: '请上传补遗文件' });
    }

    const pid = projectId as string;
    const sid = sectionId ? (sectionId as string) : null;

    const project = await prisma.project.findUnique({ where: { id: pid } });
    if (!project) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: '项目不存在' });
    }

    if (sid) {
      const section = await prisma.section.findUnique({ where: { id: sid } });
      if (!section || section.projectId !== pid) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: '标段不存在或不属于该项目' });
      }
    }

    const addendum = await prisma.addendum.create({
      data: {
        projectId: pid,
        sectionId: sid,
        title,
        description: description || null,
        fileName: req.file.originalname,
        filePath: req.file.filename,
        fileSize: req.file.size,
        uploadedBy,
      },
    });

    await createAuditLog({
      action: 'UPLOAD',
      entityType: 'Addendum',
      entityId: addendum.id,
      userName: uploadedBy,
      remarks: `上传补遗文件: ${req.file.originalname}`,
      projectId: pid,
      addendumId: addendum.id,
      afterState: addendum,
    });

    res.status(201).json(addendum);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '上传补遗文件失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, sectionId } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (sectionId) where.sectionId = sectionId as string;

    const addendums = await prisma.addendum.findMany({
      where,
      include: {
        section: true,
        _count: {
          select: {
            confirmations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(addendums);
  } catch (error) {
    res.status(500).json({ error: '获取补遗列表失败' });
  }
});

router.get('/:id', [
  param('id').notEmpty().withMessage('补遗ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const addendum = await prisma.addendum.findUnique({
      where: { id },
      include: {
        section: true,
        project: true,
        confirmations: {
          include: {
            supplier: true,
          },
        },
      },
    });

    if (!addendum) {
      return res.status(404).json({ error: '补遗不存在' });
    }

    res.json(addendum);
  } catch (error) {
    res.status(500).json({ error: '获取补遗详情失败' });
  }
});

router.delete('/:id', [
  param('id').notEmpty().withMessage('补遗ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const addendum = await prisma.addendum.findUnique({ where: { id } });
    if (!addendum) {
      return res.status(404).json({ error: '补遗不存在' });
    }

    const filePath = path.join(uploadDir, addendum.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.addendum.delete({ where: { id } });

    await createAuditLog({
      action: 'DELETE',
      entityType: 'Addendum',
      entityId: id,
      userName: 'admin',
      remarks: `删除补遗文件: ${addendum.fileName}`,
      projectId: addendum.projectId,
      addendumId: id,
      beforeState: addendum,
    });

    res.json({ message: '补遗已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除补遗失败' });
  }
});

router.post('/:id/confirm', [
  param('id').notEmpty().withMessage('补遗ID不能为空'),
  body('supplierId').notEmpty().withMessage('供应商ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { supplierId, notes } = req.body;

    const addendum = await prisma.addendum.findUnique({ where: { id } });
    if (!addendum) {
      return res.status(404).json({ error: '补遗不存在' });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    const existingConfirmation = await prisma.supplierConfirmation.findFirst({
      where: { addendumId: id, supplierId },
    });

    let confirmation;
    if (existingConfirmation) {
      confirmation = await prisma.supplierConfirmation.update({
        where: { id: existingConfirmation.id },
        data: {
          confirmed: true,
          confirmedAt: new Date(),
          notes: notes || null,
        },
      });
    } else {
      confirmation = await prisma.supplierConfirmation.create({
        data: {
          supplierId,
          addendumId: id,
          sectionId: addendum.sectionId,
          confirmed: true,
          confirmedAt: new Date(),
          notes: notes || null,
        },
      });
    }

    await createAuditLog({
      action: 'CONFIRM',
      entityType: 'SupplierConfirmation',
      entityId: confirmation.id,
      userName: supplier.name,
      remarks: `供应商确认收到补遗: ${addendum.title}`,
      projectId: addendum.projectId,
      addendumId: id,
      afterState: confirmation,
    });

    res.json(confirmation);
  } catch (error) {
    res.status(500).json({ error: '确认补遗失败' });
  }
});

router.get('/:id/confirmations', [
  param('id').notEmpty().withMessage('补遗ID不能为空'),
  validateRequest,
], async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const confirmations = await prisma.supplierConfirmation.findMany({
      where: { addendumId: id },
      include: {
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(confirmations);
  } catch (error) {
    res.status(500).json({ error: '获取确认列表失败' });
  }
});

export default router;
