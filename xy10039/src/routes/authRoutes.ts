import express from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/authService';
import {
  authenticateToken,
  isAdmin,
  AuthenticatedRequest
} from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { UserRole } from '../types';

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

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('邮箱格式无效'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密码至少6个字符'),
    body('name').notEmpty().withMessage('姓名不能为空')
  ],
  handleValidation,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const { email, password, name, role } = req.body;
      const user = await AuthService.register(
        email,
        password,
        name,
        role || UserRole.OPERATOR
      );
      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('邮箱格式无效'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  handleValidation,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json({
        success: true,
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/profile',
  authenticateToken,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new NotFoundError('用户');
      }
      const user = await AuthService.getProfile(req.user.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/users',
  authenticateToken,
  isAdmin,
  async (
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const users = await AuthService.listUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/users/:id/role',
  authenticateToken,
  isAdmin,
  [
    body('role')
      .isIn(Object.values(UserRole))
      .withMessage('无效的角色值')
  ],
  handleValidation,
  async (
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const { role } = req.body;
      const user = await AuthService.updateUserRole(
        req.params.id,
        role,
        req.user!.id
      );
      res.json({
        success: true,
        data: {
          id: user.id,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
