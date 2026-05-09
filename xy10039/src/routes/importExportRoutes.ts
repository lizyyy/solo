import express from 'express';
import multer from 'multer';
import { ImportExportService } from '../services/importExportService';
import {
  authenticateToken,
  requireRoles,
  AuthenticatedRequest
} from '../middleware/auth';
import { UserRole, RegistrationStatus } from '../types';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV文件'));
    }
  }
});

router.use(authenticateToken);

router.post(
  '/import',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  upload.single('file'),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '未上传文件'
        });
        return;
      }

      const activityId = req.body.activityId;
      if (!activityId) {
        res.status(400).json({
          success: false,
          message: '缺少活动ID'
        });
        return;
      }

      const result = await ImportExportService.importFromCsv(
        req.file.buffer,
        activityId,
        req.user!.id,
        req.file.originalname
      );

      res.json({
        success: true,
        data: result,
        message: result.failed > 0
          ? `部分导入成功: ${result.success}/${result.total}`
          : `成功导入 ${result.success} 条记录`
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/import/history',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const history = await ImportExportService.getImportHistory(req.user!.id);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/import/:batchId/retry',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const result = await ImportExportService.retryFailedBatch(
        req.params.batchId,
        req.user!.id
      );

      if (!result) {
        res.status(404).json({
          success: false,
          message: '没有可重试的失败记录'
        });
        return;
      }

      res.json({
        success: true,
        data: result,
        message: `重试完成: ${result.success}/${result.total}`
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/export',
  requireRoles([
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.OPERATOR,
    UserRole.VIEWER
  ]),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const options = {
        activityId: req.query.activityId as string,
        status: req.query.status as RegistrationStatus | undefined,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined
      };

      const result = await ImportExportService.exportToCsv(options);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`
      );
      res.send('\uFEFF' + result.csv);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
