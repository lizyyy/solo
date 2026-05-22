import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.js';
import { Role } from '../../shared/types.js';
import {
  createBatch,
  getBatches,
  getBatchById,
  transitionBatchStatus,
  withdrawBatch,
  resubmitBatch,
  addAttachment
} from '../services/batchService.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.use(authenticateToken);

router.get('/', requirePermission('batch:list'), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as string | undefined;
    const keyword = req.query.keyword as string | undefined;

    const result = getBatches(page, pageSize, {
      status: status as any,
      createdBy: req.user!.id,
      keyword
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', requirePermission('batch:view'), async (req: AuthRequest, res: Response) => {
  try {
    const result = getBatchById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: '批次不存在' });
      return;
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', 
  requirePermission('batch:create', Role.CUSTOMER_SERVICE),
  upload.array('files', 10),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, remark } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!title) {
        res.status(400).json({ success: false, error: '批次标题不能为空' });
        return;
      }

      const result = createBatch({
        title,
        remark: remark || '',
        createdBy: req.user!.id,
        createdByName: req.user!.realName,
        files,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/submit', 
  requirePermission('batch:submit', Role.CUSTOMER_SERVICE),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = transitionBatchStatus(
        req.params.id,
        'SUBMIT',
        req.user!.id,
        req.user!.realName,
        req.body.reason,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/withdraw', 
  requirePermission('batch:withdraw', Role.CUSTOMER_SERVICE),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = withdrawBatch(
        req.params.id,
        req.user!.id,
        req.user!.realName,
        req.body.reason || '用户撤回',
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/resubmit', 
  requirePermission('batch:submit', Role.CUSTOMER_SERVICE),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, remark } = req.body;
      const result = resubmitBatch(
        req.params.id,
        title,
        remark || '',
        req.user!.id,
        req.user!.realName,
        req.ip
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }
);

router.post('/:id/attachments', 
  requirePermission('batch:attach', Role.CUSTOMER_SERVICE),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: '请选择要上传的文件' });
        return;
      }

      addAttachment(
        req.params.id,
        req.file,
        req.user!.id,
        req.user!.realName,
        req.ip
      );

      res.json({ success: true, message: '附件上传成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

router.get('/:id/attachments/:filename', 
  requirePermission('batch:view'),
  async (req: AuthRequest, res: Response) => {
    try {
      const filePath = path.join(process.cwd(), 'uploads', req.params.id, req.params.filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ success: false, error: '文件不存在' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

export default router;
