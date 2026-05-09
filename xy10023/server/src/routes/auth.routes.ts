import { Router } from 'express';
import { requireAgent, requireAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import authService from '../services/auth.service';
import { UserRole } from '../models/User';
import logger from '../utils/logger';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(400).json({
      error: 'REGISTRATION_FAILED',
      message: (error as Error).message,
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { user, tokens } = await authService.login(req.body);
    res.json({
      user: user.toJSON(),
      tokens,
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(401).json({
      error: 'LOGIN_FAILED',
      message: (error as Error).message,
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({
        error: 'MISSING_TOKEN',
        message: 'Refresh token is required',
      });
      return;
    }

    const tokens = await authService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    logger.error('Refresh token failed:', error);
    res.status(401).json({
      error: 'REFRESH_FAILED',
      message: (error as Error).message,
    });
  }
});

router.get('/me', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
      return;
    }
    res.json(user.toJSON());
  } catch (error) {
    logger.error('Get profile failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get profile',
    });
  }
});

router.put('/password', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Old and new passwords are required',
      });
      return;
    }

    await authService.changePassword(req.user!.id, oldPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password failed:', error);
    res.status(400).json({
      error: 'PASSWORD_CHANGE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await authService.listUsers();
    res.json({ users: users.map((u) => u.toJSON()) });
  } catch (error) {
    logger.error('List users failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list users',
    });
  }
});

router.put('/users/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_BODY',
        message: 'isActive must be a boolean',
      });
      return;
    }

    const user = await authService.toggleUserActive(req.params.id, isActive);
    res.json({ user: user.toJSON() });
  } catch (error) {
    logger.error('Toggle user failed:', error);
    res.status(400).json({
      error: 'TOGGLE_FAILED',
      message: (error as Error).message,
    });
  }
});

export default router;
