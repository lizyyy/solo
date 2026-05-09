import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { RegistrationService } from '../services/registrationService';
import {
  authenticateToken,
  requireRoles,
  AuthenticatedRequest
} from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { RegistrationStatus, UserRole } from '../types';

const router = express.Router();

function handleValidation(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap: Record<string, string[]> = {};
    errors.array().forEach((err: any) => {
      const path = err.path || err.param;
      if (!errorMap[path]) errorMap[path] = [];
      errorMap[path].push(err.msg);
    });
    throw new ValidationError(errorMap);
  }
  next();
}

router.use(authenticateToken);

router.post(
  '/',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  [
    body('activityId').notEmpty().withMessage('活动ID不能为空'),
    body('name').notEmpty().withMessage('姓名不能为空'),
    body('email').isEmail().withMessage('邮箱格式无效')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const registration = await RegistrationService.create(
        req.body,
        req.user!.id
      );
      res.status(201).json({ success: true, data: registration });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    query('status').optional().isIn(Object.values(RegistrationStatus)),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidation,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const query = {
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      };
      const result = await RegistrationService.list(query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/statistics',
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const stats = await RegistrationService.getStatistics(
        req.query.activityId as string
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const registration = await RegistrationService.getById(req.params.id);
      res.json({ success: true, data: registration });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const registration = await RegistrationService.update(
        req.params.id,
        req.body,
        req.user!.id
      );
      res.json({ success: true, data: registration });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/status',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  [
    body('status')
      .isIn(Object.values(RegistrationStatus))
      .withMessage('无效的报名状态')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const registration = await RegistrationService.updateStatus(
        req.params.id,
        req.body.status,
        req.user!.id,
        req.body.reason
      );
      res.json({ success: true, data: registration });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/batch/status',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR]),
  [
    body('ids').isArray({ min: 1 }).withMessage('至少选择一个报名记录'),
    body('newStatus')
      .isIn(Object.values(RegistrationStatus))
      .withMessage('无效的报名状态')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const result = await RegistrationService.batchUpdateStatus(
        req.body,
        req.user!.id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  requireRoles([UserRole.ADMIN]),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      await RegistrationService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: '报名记录已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
