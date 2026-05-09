import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { importExportService } from '../services/import-export-service';
import { authenticate, requireOperator, requireViewer } from '../middleware/auth';
import { AuthRequest, RefundFilter } from '../types';
import { successResponse } from '../utils/response';
import { RefundStatus, RefundReason } from '@prisma/client';

const router = Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV文件') as any, false);
    }
  }
});

router.use(authenticate);

router.get('/export', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const filter: RefundFilter = {
      status: req.query.status ? (req.query.status as string).split(',') as RefundStatus[] : undefined,
      reason: req.query.reason ? (req.query.reason as string).split(',') as RefundReason[] : undefined,
      orderNo: req.query.orderNo as string,
      refundNo: req.query.refundNo as string,
      customerName: req.query.customerName as string
    };

    const filePath = await importExportService.exportToCSV(filter, req.user!.userId);

    res.download(filePath, `refunds_${Date.now()}.csv`, (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/import',
  requireOperator,
  upload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件'
        });
      }

      const result = await importExportService.importFromCSV(req.file.path, req.user!.userId);
      return successResponse(res, result, '导入完成');
    } catch (error) {
      next(error);
    }
  }
);

router.get('/logs', requireViewer, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);

    const result = await importExportService.getImportExportLogs(req.user!.userId, page, limit);
    return successResponse(res, result.data, '获取成功', result.pagination);
  } catch (error) {
    next(error);
  }
});

export default router;
