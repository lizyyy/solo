import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { ActivityService } from '../services/activityService';
import {
  authenticateToken,
  requireRoles,
  AuthenticatedRequest
} from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import { ActivityStatus, UserRole } from '../types';

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
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  [
    body('name').notEmpty().withMessage('活动名称不能为空'),
    body('location').notEmpty().withMessage('活动地点不能为空'),
    body('startTime').isISO8601().withMessage('开始时间必须是有效的日期'),
    body('endTime').isISO8601().withMessage('结束时间必须是有效的日期'),
    body('maxParticipants')
      .isInt({ min: 1 })
      .withMessage('最大参与人数必须是正整数')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const activity = await ActivityService.create(
        req.body,
        req.user!.id
      );
      res.status(201).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  [
    query('status').optional().isIn(Object.values(ActivityStatus)),
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
      const result = await ActivityService.list(query);
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
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const stats = await ActivityService.getStatistics();
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
      const activity = await ActivityService.getById(req.params.id);
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const activity = await ActivityService.update(
        req.params.id,
        req.body,
        req.user!.id
      );
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/status',
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  [
    body('status')
      .isIn(Object.values(ActivityStatus))
      .withMessage('无效的活动状态')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const activity = await ActivityService.updateStatus(
        req.params.id,
        req.body.status,
        req.user!.id
      );
      res.json({ success: true, data: activity });
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
      await ActivityService.delete(req.params.id, req.user!.id);
      res.json({ success: true, message: '活动已删除' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
