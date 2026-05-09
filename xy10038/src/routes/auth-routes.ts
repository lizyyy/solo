import { Router } from 'express';
import { body } from 'express-validator';
import { authService } from '../services/auth-service';
import { authenticate, requireAdmin, requireManager } from '../middleware/auth';
import { validationErrorHandler } from '../middleware/error-handler';
import { AuthRequest } from '../types';
import { successResponse, createdResponse } from '../utils/response';

const router = Router();

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    validationErrorHandler
  ],
  async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      return successResponse(res, result, '登录成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/register',
  authenticate,
  requireAdmin,
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('email').isEmail().withMessage('邮箱格式不正确'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('role').optional().isIn(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']),
    validationErrorHandler
  ],
  async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      return createdResponse(res, user, '用户创建成功');
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user!.userId);
    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/change-password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位'),
    validationErrorHandler
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, oldPassword, newPassword);
      return successResponse(res, null, '密码修改成功');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
